using System;
using System.Collections.Generic;
using System.IO;
using System.Net;
using System.Net.Sockets;
using System.Security.Cryptography;
using System.Text;
using System.Threading;
using System.Threading.Tasks;

/* Servidor LAN de Riposte Frontline (fork): archivos del juego + senalizacion compatible con peerjs-server 1.0 (npm "peer").
   C# 5 a proposito (Windows PowerShell 5.1 / Add-Type). Sin HttpListener: TcpListener en 0.0.0.0 no pide urlacl. */
public class LanHost
{
    const string WsMagic = "258EAFA5-E914-47DA-95CA-C5AB0DC85B11";
    const string ApiKey = "peerjs";
    const int MaxMsg = 2000000;
    const int ExpireMs = 5000;
    const int AliveMs = 90000;

    static readonly object Gate = new object();
    static readonly Dictionary<string, Peer> Peers = new Dictionary<string, Peer>();
    static readonly Dictionary<string, MsgQueue> Queues = new Dictionary<string, MsgQueue>();
    static string RootFull;
    static TcpListener Listener;
    static Timer Sweep;
    public static volatile bool Running;
    public static string StartError = "";

    class Peer
    {
        public string Id;
        public string Token;
        public TcpClient Client;
        public NetworkStream Stream;
        public object SendLock;
        public long LastPing;
    }

    class QMsg
    {
        public string Json;
        public string Src;
        public string Dst;
    }

    class MsgQueue
    {
        public long LastRead;
        public List<QMsg> Items;
        public MsgQueue()
        {
            LastRead = NowMs();
            Items = new List<QMsg>();
        }
    }

    class ConnBuf
    {
        NetworkStream stream;
        byte[] buf;
        int pos;
        int len;
        public ConnBuf(NetworkStream s)
        {
            stream = s;
            buf = new byte[8192];
            pos = 0;
            len = 0;
        }
        public async Task<int> ReadByte()
        {
            if (pos >= len)
            {
                len = await stream.ReadAsync(buf, 0, buf.Length);
                pos = 0;
                if (len <= 0) return -1;
            }
            return buf[pos++];
        }
        public async Task ReadExact(byte[] dst, int n)
        {
            int o = 0;
            while (o < n)
            {
                int b = await ReadByte();
                if (b < 0) throw new IOException("eof");
                dst[o++] = (byte)b;
            }
        }
        public async Task<string> ReadHttpHead()
        {
            var sb = new StringBuilder();
            while (sb.Length < 65536)
            {
                int b = await ReadByte();
                if (b < 0) return null;
                sb.Append((char)b);
                int L = sb.Length;
                if (L >= 4 && sb[L - 4] == '\r' && sb[L - 3] == '\n' && sb[L - 2] == '\r' && sb[L - 1] == '\n')
                    return sb.ToString();
            }
            return null;
        }
    }

    public static bool Start(string root, int port, string bind)
    {
        try
        {
            RootFull = Path.GetFullPath(root);
            if (!RootFull.EndsWith(Path.DirectorySeparatorChar.ToString()))
                RootFull = RootFull + Path.DirectorySeparatorChar;
            IPAddress ip = IPAddress.Parse(bind);
            Listener = new TcpListener(ip, port);
            Listener.Server.SetSocketOption(SocketOptionLevel.Socket, SocketOptionName.ReuseAddress, true);
            Listener.Start();
            Running = true;
            Sweep = new Timer(Prune, null, 1000, 1000);
            return true;
        }
        catch (Exception ex)
        {
            StartError = ex.Message;
            return false;
        }
    }

    public static void Loop()
    {
        while (Running)
        {
            TcpClient c = null;
            try { c = Listener.AcceptTcpClient(); }
            catch (Exception)
            {
                if (!Running) break;
                continue;
            }
            c.NoDelay = true;
            Fire(Handle(c));
        }
    }

    public static void Stop()
    {
        Running = false;
        try { if (Listener != null) Listener.Stop(); } catch (Exception) {}
        try { if (Sweep != null) Sweep.Dispose(); } catch (Exception) {}
    }

    static void Fire(Task t)
    {
        t.ContinueWith(delegate(Task x)
        {
            if (x.IsFaulted && x.Exception != null)
                Console.WriteLine("[lan] " + x.Exception.GetBaseException().Message);
        });
    }

    static long NowMs()
    {
        return DateTime.UtcNow.Ticks / 10000L;
    }

    static async Task Handle(TcpClient client)
    {
        try
        {
            using (client)
            {
                NetworkStream stream = client.GetStream();
                ConnBuf buf = new ConnBuf(stream);
                string head = await buf.ReadHttpHead();
                if (head == null) return;
                string[] lines = head.Split(new string[] { "\r\n" }, StringSplitOptions.None);
                if (lines.Length < 1) return;
                string[] req = lines[0].Split(' ');
                if (req.Length < 2) return;
                string method = req[0].ToUpperInvariant();
                string target = req[1];
                int q = target.IndexOf('?');
                string path = q >= 0 ? target.Substring(0, q) : target;
                string query = q >= 0 ? target.Substring(q + 1) : "";
                var headers = new Dictionary<string, string>(StringComparer.OrdinalIgnoreCase);
                for (int i = 1; i < lines.Length; i++)
                {
                    int c = lines[i].IndexOf(':');
                    if (c <= 0) continue;
                    headers[lines[i].Substring(0, c).Trim()] = lines[i].Substring(c + 1).Trim();
                }
                string route = path;
                if (route.Length > 1 && route.EndsWith("/")) route = route.Substring(0, route.Length - 1);
                bool upgrade = HeaderHas(headers, "Upgrade", "websocket") && HeaderHas(headers, "Connection", "Upgrade");
                if (upgrade && (route == "/peerjs"))
                {
                    await HandleWs(client, stream, buf, headers, query);
                    return;
                }
                if (method == "OPTIONS")
                {
                    WriteHttp(stream, 204, "No Content", "text/plain; charset=utf-8", new byte[0], true);
                    return;
                }
                if (method == "GET" && route == "/peerjs/id")
                {
                    string id = NewId();
                    WriteHttp(stream, 200, "OK", "text/html; charset=utf-8", Encoding.UTF8.GetBytes(id), true);
                    return;
                }
                if (method == "GET" && route == "/peerjs/peers")
                {
                    byte[] body = Encoding.UTF8.GetBytes(PeersJson());
                    WriteHttp(stream, 200, "OK", "application/json; charset=utf-8", body, true);
                    return;
                }
                if (method != "GET" && method != "HEAD")
                {
                    WriteHttp(stream, 405, "Method Not Allowed", "text/plain; charset=utf-8", Encoding.ASCII.GetBytes("Method not allowed"), true);
                    return;
                }
                ServeFile(stream, path, method == "HEAD");
            }
        }
        catch (Exception ex)
        {
            Console.WriteLine("[lan] conn " + ex.GetType().Name + " " + ex.Message);
        }
    }

    static bool HeaderHas(Dictionary<string, string> headers, string name, string needle)
    {
        string v;
        if (!headers.TryGetValue(name, out v) || v == null) return false;
        return v.IndexOf(needle, StringComparison.OrdinalIgnoreCase) >= 0;
    }

    static Dictionary<string, string> ParseQuery(string q)
    {
        var d = new Dictionary<string, string>();
        if (string.IsNullOrEmpty(q)) return d;
        string[] parts = q.Split('&');
        for (int i = 0; i < parts.Length; i++)
        {
            string part = parts[i];
            if (part.Length == 0) continue;
            int eq = part.IndexOf('=');
            string k, v;
            if (eq < 0) { k = part; v = ""; }
            else { k = part.Substring(0, eq); v = part.Substring(eq + 1); }
            k = Uri.UnescapeDataString(k.Replace('+', ' '));
            v = Uri.UnescapeDataString(v.Replace('+', ' '));
            d[k] = v;
        }
        return d;
    }

    static async Task HandleWs(TcpClient client, NetworkStream stream, ConnBuf buf, Dictionary<string, string> headers, string query)
    {
        string key;
        if (!headers.TryGetValue("Sec-WebSocket-Key", out key) || string.IsNullOrEmpty(key))
        {
            WriteHttp(stream, 400, "Bad Request", "text/plain; charset=utf-8", Encoding.ASCII.GetBytes("Bad Request"), false);
            return;
        }
        string accept;
        using (SHA1 sha = SHA1.Create())
        {
            byte[] hash = sha.ComputeHash(Encoding.ASCII.GetBytes(key.Trim() + WsMagic));
            accept = Convert.ToBase64String(hash);
        }
        string resp = "HTTP/1.1 101 Switching Protocols\r\nUpgrade: websocket\r\nConnection: Upgrade\r\nSec-WebSocket-Accept: " + accept + "\r\n\r\n";
        byte[] respB = Encoding.ASCII.GetBytes(resp);
        stream.Write(respB, 0, respB.Length);
        stream.Flush();

        var qs = ParseQuery(query);
        string id, token, k;
        qs.TryGetValue("id", out id);
        qs.TryGetValue("token", out token);
        qs.TryGetValue("key", out k);
        if (string.IsNullOrEmpty(id) || string.IsNullOrEmpty(token) || string.IsNullOrEmpty(k))
        {
            SendRaw(stream, "{\"type\":\"ERROR\",\"payload\":{\"msg\":\"No id, token, or key supplied to websocket server\"}}");
            return;
        }
        if (k != ApiKey)
        {
            SendRaw(stream, "{\"type\":\"ERROR\",\"payload\":{\"msg\":\"Invalid key provided\"}}");
            return;
        }

        Peer peer = null;
        bool taken = false;
        bool limit = false;
        lock (Gate)
        {
            Peer existing;
            if (Peers.TryGetValue(id, out existing))
            {
                if (existing.Token != token) taken = true;
                else
                {
                    TcpClient old = existing.Client;
                    existing.Client = client;
                    existing.Stream = stream;
                    existing.LastPing = NowMs();
                    peer = existing;
                    try { if (old != null && old != client) old.Close(); } catch (Exception) {}
                }
            }
            else
            {
                if (Peers.Count >= 5000) limit = true;
                else
                {
                    peer = new Peer();
                    peer.Id = id;
                    peer.Token = token;
                    peer.Client = client;
                    peer.Stream = stream;
                    peer.SendLock = new object();
                    peer.LastPing = NowMs();
                    Peers[id] = peer;
                }
            }
        }
        if (taken)
        {
            SendRaw(stream, "{\"type\":\"ID-TAKEN\",\"payload\":{\"msg\":\"ID is taken\"}}");
            Console.WriteLine("[lan] ID-TAKEN " + id);
            return;
        }
        if (limit)
        {
            SendRaw(stream, "{\"type\":\"ERROR\",\"payload\":{\"msg\":\"Server has reached its concurrent user limit\"}}");
            return;
        }
        SendText(peer, "{\"type\":\"OPEN\"}");
        Console.WriteLine("[lan] OPEN " + id);
        FlushQueue(peer);

        var frag = new MemoryStream();
        int fragOp = 0;
        while (Running && peer.Client == client)
        {
            int b0 = await buf.ReadByte();
            if (b0 < 0) break;
            int b1 = await buf.ReadByte();
            if (b1 < 0) break;
            bool fin = (b0 & 0x80) != 0;
            int opcode = b0 & 0x0F;
            bool masked = (b1 & 0x80) != 0;
            long ln = b1 & 0x7F;
            if (ln == 126)
            {
                byte[] ext = new byte[2];
                await buf.ReadExact(ext, 2);
                ln = (ext[0] << 8) | ext[1];
            }
            else if (ln == 127)
            {
                byte[] ext = new byte[8];
                await buf.ReadExact(ext, 8);
                ln = 0;
                for (int i = 0; i < 8; i++) ln = (ln << 8) | ext[i];
            }
            if (ln < 0 || ln > MaxMsg) break;
            byte[] mask = null;
            if (masked)
            {
                mask = new byte[4];
                await buf.ReadExact(mask, 4);
            }
            byte[] payload = new byte[ln];
            if (ln > 0) await buf.ReadExact(payload, (int)ln);
            if (masked)
            {
                for (int i = 0; i < payload.Length; i++) payload[i] = (byte)(payload[i] ^ mask[i % 4]);
            }
            if (opcode == 8) break;
            if (opcode == 9)
            {
                SendCtrl(peer, 0x8A, payload);
                continue;
            }
            if (opcode == 10) continue;
            if (opcode == 1 || opcode == 2 || opcode == 0)
            {
                if (opcode != 0)
                {
                    frag.SetLength(0);
                    fragOp = opcode;
                }
                if (frag.Length + payload.Length > MaxMsg) break;
                frag.Write(payload, 0, payload.Length);
                if (fin)
                {
                    string text = Encoding.UTF8.GetString(frag.ToArray());
                    frag.SetLength(0);
                    if (fragOp == 1 || fragOp == 2) OnMessage(peer, text);
                }
            }
        }
        lock (Gate)
        {
            Peer cur;
            if (Peers.TryGetValue(id, out cur) && cur.Client == client)
            {
                Peers.Remove(id);
                Console.WriteLine("[lan] CLOSE " + id);
            }
        }
    }

    static void OnMessage(Peer peer, string text)
    {
        Dictionary<string, string> fields = TopFields(text);
        if (fields == null) return;
        string typeRaw;
        if (!fields.TryGetValue("type", out typeRaw)) return;
        string type = JUnquote(typeRaw);
        if (type == "HEARTBEAT")
        {
            peer.LastPing = NowMs();
            SendText(peer, "{\"type\":\"HEARTBEAT\"}");
            return;
        }
        if (type != "OFFER" && type != "ANSWER" && type != "CANDIDATE" && type != "LEAVE" && type != "EXPIRE")
            return;
        string dstRaw, payload;
        fields.TryGetValue("dst", out dstRaw);
        fields.TryGetValue("payload", out payload);
        string dst = dstRaw == null ? null : JUnquote(dstRaw);
        string src = peer.Id;
        var sb = new StringBuilder();
        sb.Append("{\"type\":");
        sb.Append(JQuote(type));
        sb.Append(",\"src\":");
        sb.Append(JQuote(src));
        if (dst != null)
        {
            sb.Append(",\"dst\":");
            sb.Append(JQuote(dst));
        }
        if (payload != null)
        {
            sb.Append(",\"payload\":");
            sb.Append(payload);
        }
        sb.Append("}");
        string json = sb.ToString();
        Console.WriteLine("[lan] " + type + " " + src + " -> " + (dst == null ? "-" : dst));
        if (string.IsNullOrEmpty(dst))
        {
            if (type == "LEAVE")
            {
                lock (Gate) { Peers.Remove(src); }
            }
            return;
        }
        Peer dest = null;
        bool queued = false;
        lock (Gate)
        {
            if (!Peers.TryGetValue(dst, out dest))
            {
                if (type != "LEAVE" && type != "EXPIRE")
                {
                    MsgQueue q;
                    if (!Queues.TryGetValue(dst, out q))
                    {
                        q = new MsgQueue();
                        Queues[dst] = q;
                    }
                    if (q.Items.Count < 64)
                    {
                        QMsg m = new QMsg();
                        m.Json = json;
                        m.Src = src;
                        m.Dst = dst;
                        q.Items.Add(m);
                    }
                    queued = true;
                }
            }
        }
        if (queued)
        {
            Console.WriteLine("[lan] queue " + type + " for " + dst);
            return;
        }
        if (dest != null) SendText(dest, json);
    }

    static void FlushQueue(Peer peer)
    {
        List<QMsg> items = null;
        lock (Gate)
        {
            MsgQueue q;
            if (Queues.TryGetValue(peer.Id, out q))
            {
                items = q.Items;
                Queues.Remove(peer.Id);
            }
        }
        if (items == null) return;
        for (int i = 0; i < items.Count; i++)
        {
            Console.WriteLine("[lan] flush -> " + peer.Id);
            SendText(peer, items[i].Json);
        }
    }

    static void Prune(object state)
    {
        long now = NowMs();
        var dead = new List<Peer>();
        var expires = new List<string[]>();
        lock (Gate)
        {
            var ids = new List<string>(Peers.Keys);
            for (int i = 0; i < ids.Count; i++)
            {
                Peer p = Peers[ids[i]];
                if (now - p.LastPing < AliveMs) continue;
                Peers.Remove(ids[i]);
                Queues.Remove(ids[i]);
                dead.Add(p);
                Console.WriteLine("[lan] EXPIRE-IDLE " + ids[i]);
            }
            var qids = new List<string>(Queues.Keys);
            for (int i = 0; i < qids.Count; i++)
            {
                MsgQueue q = Queues[qids[i]];
                if (q == null || now - q.LastRead < ExpireMs) continue;
                var seen = new Dictionary<string, bool>();
                for (int j = 0; j < q.Items.Count; j++)
                {
                    QMsg m = q.Items[j];
                    string sk = m.Src + "\n" + m.Dst;
                    if (seen.ContainsKey(sk)) continue;
                    seen[sk] = true;
                    expires.Add(new string[] { m.Src, m.Dst });
                }
                Queues.Remove(qids[i]);
            }
        }
        for (int i = 0; i < dead.Count; i++)
        {
            try { dead[i].Client.Close(); } catch (Exception) {}
        }
        for (int i = 0; i < expires.Count; i++)
        {
            string src = expires[i][0];
            string dst = expires[i][1];
            Peer p = null;
            lock (Gate) { Peers.TryGetValue(src, out p); }
            if (p == null) continue;
            string ej = "{\"type\":\"EXPIRE\",\"src\":" + JQuote(dst) + ",\"dst\":" + JQuote(src) + "}";
            SendText(p, ej);
            Console.WriteLine("[lan] EXPIRE " + dst + " -> " + src);
        }
    }

    static void SendText(Peer peer, string text)
    {
        if (peer == null || peer.Stream == null || peer.SendLock == null) return;
        byte[] data = Encoding.UTF8.GetBytes(text);
        byte[] frame = BuildFrame(0x81, data);
        lock (peer.SendLock)
        {
            NetworkStream s = peer.Stream;
            if (s == null) return;
            try
            {
                s.Write(frame, 0, frame.Length);
                s.Flush();
            }
            catch (Exception) {}
        }
    }

    static void SendCtrl(Peer peer, byte opcode, byte[] payload)
    {
        if (peer == null || peer.SendLock == null) return;
        if (payload == null) payload = new byte[0];
        byte[] frame = BuildFrame(opcode, payload);
        lock (peer.SendLock)
        {
            NetworkStream s = peer.Stream;
            if (s == null) return;
            try
            {
                s.Write(frame, 0, frame.Length);
                s.Flush();
            }
            catch (Exception) {}
        }
    }

    static void SendRaw(NetworkStream stream, string text)
    {
        try
        {
            byte[] frame = BuildFrame(0x81, Encoding.UTF8.GetBytes(text));
            stream.Write(frame, 0, frame.Length);
            stream.Flush();
        }
        catch (Exception) {}
    }

    static byte[] BuildFrame(byte opcode, byte[] data)
    {
        int n = data.Length;
        byte[] hdr;
        if (n < 126) hdr = new byte[] { opcode, (byte)n };
        else if (n < 65536) hdr = new byte[] { opcode, 126, (byte)(n >> 8), (byte)(n & 255) };
        else
        {
            hdr = new byte[10];
            hdr[0] = opcode;
            hdr[1] = 127;
            long v = n;
            for (int i = 7; i >= 0; i--)
            {
                hdr[2 + i] = (byte)(v & 255);
                v >>= 8;
            }
        }
        byte[] frame = new byte[hdr.Length + n];
        Buffer.BlockCopy(hdr, 0, frame, 0, hdr.Length);
        Buffer.BlockCopy(data, 0, frame, hdr.Length, n);
        return frame;
    }

    static string NewId()
    {
        byte[] b = new byte[16];
        using (RandomNumberGenerator rng = RandomNumberGenerator.Create())
        {
            rng.GetBytes(b);
        }
        const string abc = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
        var sb = new StringBuilder();
        for (int i = 0; i < b.Length; i++) sb.Append(abc[b[i] % abc.Length]);
        string id = sb.ToString();
        lock (Gate)
        {
            while (Peers.ContainsKey(id))
            {
                id = id + "x";
            }
        }
        return id;
    }

    static string PeersJson()
    {
        var sb = new StringBuilder();
        sb.Append('[');
        bool first = true;
        lock (Gate)
        {
            foreach (string id in Peers.Keys)
            {
                if (!first) sb.Append(',');
                first = false;
                sb.Append(JQuote(id));
            }
        }
        sb.Append(']');
        return sb.ToString();
    }

    static void ServeFile(NetworkStream stream, string urlPath, bool headOnly)
    {
        string rel = urlPath;
        try { rel = Uri.UnescapeDataString(urlPath); } catch (Exception) { rel = urlPath; }
        if (rel.StartsWith("/")) rel = rel.Substring(1);
        if (rel.Length == 0) rel = "index.html";
        rel = rel.Replace('\\', '/');
        if (rel.IndexOf("..") >= 0 || rel.IndexOf('\0') >= 0)
        {
            WriteHttp(stream, 400, "Bad Request", "text/plain; charset=utf-8", Encoding.ASCII.GetBytes("Bad path"), true);
            return;
        }
        string combined = Path.Combine(RootFull, rel.Replace('/', Path.DirectorySeparatorChar));
        string full;
        try { full = Path.GetFullPath(combined); }
        catch (Exception)
        {
            WriteHttp(stream, 400, "Bad Request", "text/plain; charset=utf-8", Encoding.ASCII.GetBytes("Bad path"), true);
            return;
        }
        if (!full.StartsWith(RootFull, StringComparison.OrdinalIgnoreCase))
        {
            WriteHttp(stream, 403, "Forbidden", "text/plain; charset=utf-8", Encoding.ASCII.GetBytes("Forbidden"), true);
            return;
        }
        if (!File.Exists(full))
        {
            byte[] nf = Encoding.ASCII.GetBytes("Not found");
            WriteHttp(stream, 404, "Not Found", "text/plain; charset=utf-8", nf, true);
            return;
        }
        byte[] body;
        try { body = File.ReadAllBytes(full); }
        catch (Exception)
        {
            WriteHttp(stream, 500, "Error", "text/plain; charset=utf-8", Encoding.ASCII.GetBytes("Error"), true);
            return;
        }
        if (headOnly) body = new byte[0];
        WriteHttp(stream, 200, "OK", Mime(full), body, true);
    }

    static string Mime(string path)
    {
        string e = Path.GetExtension(path).ToLowerInvariant();
        if (e == ".html" || e == ".htm") return "text/html; charset=utf-8";
        if (e == ".js" || e == ".mjs") return "application/javascript; charset=utf-8";
        if (e == ".css") return "text/css; charset=utf-8";
        if (e == ".json") return "application/json; charset=utf-8";
        if (e == ".png") return "image/png";
        if (e == ".jpg" || e == ".jpeg") return "image/jpeg";
        if (e == ".webp") return "image/webp";
        if (e == ".svg") return "image/svg+xml";
        if (e == ".ico") return "image/x-icon";
        if (e == ".mp3") return "audio/mpeg";
        if (e == ".woff2") return "font/woff2";
        if (e == ".webmanifest") return "application/manifest+json";
        if (e == ".txt") return "text/plain; charset=utf-8";
        if (e == ".wasm") return "application/wasm";
        return "application/octet-stream";
    }

    static void WriteHttp(NetworkStream stream, int code, string reason, string ctype, byte[] body, bool cors)
    {
        if (body == null) body = new byte[0];
        var sb = new StringBuilder();
        sb.Append("HTTP/1.1 ");
        sb.Append(code);
        sb.Append(" ");
        sb.Append(reason);
        sb.Append("\r\nContent-Type: ");
        sb.Append(ctype);
        sb.Append("\r\nContent-Length: ");
        sb.Append(body.Length);
        sb.Append("\r\nCache-Control: no-cache\r\nConnection: close\r\n");
        if (cors)
        {
            sb.Append("Access-Control-Allow-Origin: *\r\n");
            sb.Append("Access-Control-Allow-Methods: GET, OPTIONS\r\n");
            sb.Append("Access-Control-Allow-Headers: *\r\n");
            sb.Append("Access-Control-Allow-Private-Network: true\r\n");
        }
        sb.Append("\r\n");
        byte[] hdr = Encoding.ASCII.GetBytes(sb.ToString());
        try
        {
            stream.Write(hdr, 0, hdr.Length);
            if (body.Length > 0) stream.Write(body, 0, body.Length);
            stream.Flush();
        }
        catch (Exception) {}
    }

    static string JQuote(string s)
    {
        if (s == null) return "null";
        var sb = new StringBuilder();
        sb.Append('"');
        for (int i = 0; i < s.Length; i++)
        {
            char c = s[i];
            if (c == '"' || c == '\\') { sb.Append('\\'); sb.Append(c); }
            else if (c == '\n') sb.Append("\\n");
            else if (c == '\r') sb.Append("\\r");
            else if (c == '\t') sb.Append("\\t");
            else if (c < 32)
            {
                sb.Append("\\u");
                sb.Append(((int)c).ToString("x4"));
            }
            else sb.Append(c);
        }
        sb.Append('"');
        return sb.ToString();
    }

    static string JUnquote(string raw)
    {
        if (raw == null) return null;
        raw = raw.Trim();
        if (raw.Length >= 2 && raw[0] == '"')
        {
            var sb = new StringBuilder();
            for (int i = 1; i < raw.Length - 1; i++)
            {
                char c = raw[i];
                if (c == '\\' && i + 1 < raw.Length - 1)
                {
                    char n = raw[++i];
                    if (n == '"' || n == '\\' || n == '/') sb.Append(n);
                    else if (n == 'n') sb.Append('\n');
                    else if (n == 'r') sb.Append('\r');
                    else if (n == 't') sb.Append('\t');
                    else if (n == 'u' && i + 4 < raw.Length - 1)
                    {
                        int cp = Convert.ToInt32(raw.Substring(i + 1, 4), 16);
                        i += 4;
                        sb.Append((char)cp);
                    }
                    else sb.Append(n);
                }
                else sb.Append(c);
            }
            return sb.ToString();
        }
        return raw;
    }

    static Dictionary<string, string> TopFields(string json)
    {
        try
        {
            int i = 0;
            SkipWs(json, ref i);
            if (i >= json.Length || json[i] != '{') return null;
            i++;
            var d = new Dictionary<string, string>();
            while (i < json.Length)
            {
                SkipWs(json, ref i);
                if (i < json.Length && json[i] == '}') break;
                if (i < json.Length && json[i] == ',') { i++; continue; }
                string key = ReadString(json, ref i);
                if (key == null) return null;
                SkipWs(json, ref i);
                if (i >= json.Length || json[i] != ':') return null;
                i++;
                SkipWs(json, ref i);
                int start = i;
                if (!SkipValue(json, ref i)) return null;
                if (!d.ContainsKey(key)) d[key] = json.Substring(start, i - start);
            }
            return d;
        }
        catch (Exception)
        {
            return null;
        }
    }

    static void SkipWs(string s, ref int i)
    {
        while (i < s.Length)
        {
            char c = s[i];
            if (c != ' ' && c != '\n' && c != '\r' && c != '\t') break;
            i++;
        }
    }

    static string ReadString(string s, ref int i)
    {
        SkipWs(s, ref i);
        if (i >= s.Length || s[i] != '"') return null;
        int start = i;
        if (!SkipString(s, ref i)) return null;
        return JUnquote(s.Substring(start, i - start));
    }

    static bool SkipString(string s, ref int i)
    {
        if (i >= s.Length || s[i] != '"') return false;
        i++;
        while (i < s.Length)
        {
            char c = s[i++];
            if (c == '\\')
            {
                if (i >= s.Length) return false;
                i++;
            }
            else if (c == '"') return true;
        }
        return false;
    }

    static bool SkipValue(string s, ref int i)
    {
        if (i >= s.Length) return false;
        char c = s[i];
        if (c == '"') return SkipString(s, ref i);
        if (c == '{')
        {
            i++;
            while (i < s.Length)
            {
                SkipWs(s, ref i);
                if (i < s.Length && s[i] == '}') { i++; return true; }
                if (i < s.Length && s[i] == ',') { i++; continue; }
                if (!SkipString(s, ref i)) return false;
                SkipWs(s, ref i);
                if (i >= s.Length || s[i] != ':') return false;
                i++;
                SkipWs(s, ref i);
                if (!SkipValue(s, ref i)) return false;
            }
            return false;
        }
        if (c == '[')
        {
            i++;
            while (i < s.Length)
            {
                SkipWs(s, ref i);
                if (i < s.Length && s[i] == ']') { i++; return true; }
                if (i < s.Length && s[i] == ',') { i++; continue; }
                if (!SkipValue(s, ref i)) return false;
            }
            return false;
        }
        if (c == 't' || c == 'f' || c == 'n')
        {
            while (i < s.Length && char.IsLetter(s[i])) i++;
            return true;
        }
        if (c == '-' || (c >= '0' && c <= '9'))
        {
            i++;
            while (i < s.Length)
            {
                char d = s[i];
                if ((d >= '0' && d <= '9') || d == '+' || d == '-' || d == 'e' || d == 'E' || d == '.') i++;
                else break;
            }
            return true;
        }
        return false;
    }
}
