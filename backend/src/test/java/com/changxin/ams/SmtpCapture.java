package com.changxin.ams;

import java.io.*;
import java.net.*;
import java.nio.charset.StandardCharsets;
import java.util.List;
import java.util.concurrent.*;

/** A real loopback SMTP peer; never contacts external mail servers. */
final class SmtpCapture implements AutoCloseable {
    private final ServerSocket socket;
    private final ExecutorService workers=Executors.newVirtualThreadPerTaskExecutor();
    final List<String> messages=new CopyOnWriteArrayList<>();
    volatile String rejectRecipient="";
    SmtpCapture() {
        try { socket=new ServerSocket(0,50,InetAddress.getLoopbackAddress()); }
        catch(IOException e) { throw new UncheckedIOException(e); }
        workers.submit(() -> {
            while(!socket.isClosed()) {
                try { Socket client=socket.accept(); workers.submit(() -> serve(client)); }
                catch(IOException e) { if(!socket.isClosed()) throw new UncheckedIOException(e); }
            }
        });
    }
    int port() { return socket.getLocalPort(); }
    private void serve(Socket socket) {
        try(socket; var in=new BufferedReader(new InputStreamReader(socket.getInputStream(),StandardCharsets.UTF_8));
            var out=new PrintWriter(new OutputStreamWriter(socket.getOutputStream(),StandardCharsets.UTF_8),true)) {
            socket.setSoTimeout(10000); reply(out,"220 localhost SMTP test");
            String line; boolean data=false; StringBuilder body=new StringBuilder();
            while((line=in.readLine())!=null) {
                if(data) {
                    if(line.equals(".")) { messages.add(body.toString()); data=false; reply(out,"250 accepted"); }
                    else body.append(line.startsWith("..")?line.substring(1):line).append("\r\n");
                } else if(line.startsWith("EHLO")||line.startsWith("HELO")) reply(out,"250 localhost");
                else if(line.startsWith("MAIL FROM")) { body.setLength(0); reply(out,"250 sender ok"); }
                else if(line.startsWith("RCPT TO")) reply(out,!rejectRecipient.isEmpty()&&line.contains(rejectRecipient)?"550 mailbox rejected":"250 recipient ok");
                else if(line.equals("DATA")) { data=true; reply(out,"354 end with dot"); }
                else if(line.equals("QUIT")) { reply(out,"221 bye"); break; }
                else reply(out,"250 ok");
            }
        } catch(IOException ignored) { /* peer closed */ }
    }
    private void reply(PrintWriter out,String value) { out.print(value+"\r\n"); out.flush(); }
    @Override public void close() throws IOException { socket.close(); workers.shutdownNow(); }
}
