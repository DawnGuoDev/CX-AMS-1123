package com.changxin.ams;

import static com.changxin.ams.Json.*;
import java.net.URI;
import java.nio.charset.StandardCharsets;
import java.util.Map;
import org.springframework.core.env.Environment;
import org.springframework.mail.javamail.JavaMailSenderImpl;
import org.springframework.mail.javamail.MimeMessageHelper;
import org.springframework.stereotype.Service;

/** SMTP acceptance is recorded as Success; it is not a delivery/read receipt. */
@Service
public class SmtpDelivery {
    private final JavaMailSenderImpl sender = new JavaMailSenderImpl();
    private final String from;
    private final String publicUrl;
    public SmtpDelivery(Environment env) {
        sender.setHost(env.getProperty("ams.smtp.host", ""));
        sender.setPort(env.getProperty("ams.smtp.port", Integer.class, 587));
        sender.setUsername(env.getProperty("ams.smtp.username", ""));
        sender.setPassword(env.getProperty("ams.smtp.password", ""));
        sender.setDefaultEncoding(StandardCharsets.UTF_8.name());
        var p = sender.getJavaMailProperties();
        p.put("mail.smtp.auth", env.getProperty("ams.smtp.auth", "true"));
        p.put("mail.smtp.starttls.enable", env.getProperty("ams.smtp.starttls", "true"));
        p.put("mail.smtp.starttls.required", env.getProperty("ams.smtp.starttls", "true"));
        p.put("mail.smtp.ssl.enable", env.getProperty("ams.smtp.ssl", "false"));
        p.put("mail.smtp.ssl.checkserveridentity", "true");
        for (String timeout : new String[]{"connectiontimeout", "timeout", "writetimeout"}) p.put("mail.smtp." + timeout, "5000");
        from = env.getProperty("ams.smtp.from", "");
        publicUrl = env.getProperty("ams.public-url", "").replaceAll("/+$", "");
        URI uri = URI.create(publicUrl);
        require(uri.getHost() != null && java.util.List.of("http", "https").contains(uri.getScheme())
            && uri.getFragment() == null && uri.getQuery() == null, "AMS_PUBLIC_URL 必须是可访问的 HTTP(S) 站点地址");
    }
    public boolean configured() { return sender.getHost() != null && !sender.getHost().isBlank() && !from.isBlank(); }
    public String send(Map<String,Object> notice, Map<String,Object> alarm) {
        if (!configured()) return "SMTP 未配置：请设置 AMS_SMTP_HOST 和 AMS_SMTP_FROM";
        try {
            var message = sender.createMimeMessage();
            var helper = new MimeMessageHelper(message, false, StandardCharsets.UTF_8.name());
            helper.setValidateAddresses(true);
            helper.setFrom(from);
            helper.setTo(s(notice, "TARGET"));
            helper.setSubject("[AMS] " + s(alarm, "TITLE").replaceAll("[\\r\\n]", " "));
            helper.setText("警报：" + s(alarm, "ALARM_ID") + "\n层级：" + s(notice, "LEVEL_ID")
                + "\n\n" + s(alarm, "CONTENT") + "\n\n确认链接："
                + publicUrl + "/#/ack/" + s(alarm, "ALARM_KEY")
                + "\n请以本层级通知人员的账号登录后执行 ACK。打开链接不会自动确认。", false);
            sender.send(message);
            return "";
        } catch (Exception e) {
            // SMTP exception messages may contain credentials or server configuration.
            return "SMTP 发送失败（" + e.getClass().getSimpleName() + "），请检查邮箱、连接与认证配置";
        }
    }
}
