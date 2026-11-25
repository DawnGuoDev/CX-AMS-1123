package com.changxin.ams.e2e;

import java.io.File;
import java.io.IOException;
import java.net.ServerSocket;
import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.nio.file.Files;
import java.nio.file.Path;
import java.time.Duration;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.List;

/**
 * Starts the packaged application as a real process on a random port with an isolated H2 file
 * database, and stops + removes it afterwards. Nothing is written into the repository.
 */
final class E2EInstance implements AutoCloseable {

    private final int port;
    private final Path workDir;
    private Process process;

    private E2EInstance(int port, Path workDir) {
        this.port = port;
        this.workDir = workDir;
    }

    static E2EInstance start() {
        int port = freePort();
        try {
            Path dir = Files.createTempDirectory("ams-e2e-");
            var instance = new E2EInstance(port, dir);
            instance.launch();
            return instance;
        } catch (IOException e) {
            throw new IllegalStateException("Cannot prepare the E2E instance", e);
        }
    }

    String baseUrl() {
        return "http://127.0.0.1:" + port;
    }

    private void launch() throws IOException {
        var jar = locateJar();
        var java = Path.of(System.getProperty("java.home"), "bin", "java").toString();
        var command = new ArrayList<String>(List.of(
                java,
                "-jar",
                jar.toString(),
                "--server.port=" + port,
                "--server.address=127.0.0.1",
                "--spring.datasource.url=jdbc:h2:file:" + workDir.resolve("ams-db")
                        + ";DB_CLOSE_ON_EXIT=FALSE",
                "--ams.scheduling=false",
                "--ams.smtp.host=",
                "--ams.public-url=" + baseUrl()));
        var builder = new ProcessBuilder(command);
        builder.environment().remove("PORT");
        builder.environment().remove("AMS_SMTP_HOST");
        builder.environment().put("AMS_SMTP_HOST", "");
        builder.redirectErrorStream(true);
        builder.redirectOutput(workDir.resolve("instance.log").toFile());
        process = builder.start();
        waitUntilHealthy();
    }

    /** Prefers the Spring Boot executable jar built by {@code mvn package}; falls back to surefire's classpath. */
    private static Path locateJar() throws IOException {
        Path target = Path.of("target").toAbsolutePath();
        if (Files.isDirectory(target)) {
            try (var files = Files.list(target)) {
                var jar = files.filter(p -> p.getFileName().toString().matches("ams-.*\\.jar"))
                        .filter(p -> !p.getFileName().toString().endsWith(".original"))
                        .findFirst();
                if (jar.isPresent()) {
                    return jar.get();
                }
            }
        }
        throw new IllegalStateException("Executable jar not found in " + target
                + ". Run `mvn -DskipTests package` (or scripts/build-java-vue.sh) before the E2E suite.");
    }

    private void waitUntilHealthy() {
        var client = HttpClient.newBuilder().connectTimeout(Duration.ofSeconds(2)).build();
        var deadline = System.nanoTime() + Duration.ofSeconds(120).toNanos();
        String last = "not started";
        while (System.nanoTime() < deadline) {
            if (process != null && !process.isAlive()) {
                throw new IllegalStateException("AMS process exited with code " + process.exitValue() + ". Log: "
                        + tailLog());
            }
            try {
                var request = HttpRequest.newBuilder(URI.create(baseUrl() + "/health"))
                        .timeout(Duration.ofSeconds(3))
                        .GET()
                        .build();
                var response = client.send(request, HttpResponse.BodyHandlers.discarding());
                if (response.statusCode() == 200) {
                    return;
                }
                last = "HTTP " + response.statusCode();
            } catch (IOException e) {
                last = e.getClass().getSimpleName();
            } catch (InterruptedException e) {
                Thread.currentThread().interrupt();
                throw new IllegalStateException("Interrupted while waiting for AMS to start", e);
            }
            sleep(300);
        }
        throw new IllegalStateException("AMS did not become healthy in 120s (" + last + "). Log: " + tailLog());
    }

    private String tailLog() {
        try {
            var lines = Files.readAllLines(workDir.resolve("instance.log"));
            return String.join("\n", lines.subList(Math.max(0, lines.size() - 40), lines.size()));
        } catch (IOException e) {
            return "<log unavailable: " + e.getMessage() + ">";
        }
    }

    private static void sleep(long millis) {
        try {
            Thread.sleep(millis);
        } catch (InterruptedException e) {
            Thread.currentThread().interrupt();
        }
    }

    private static int freePort() {
        try (var socket = new ServerSocket(0)) {
            return socket.getLocalPort();
        } catch (IOException e) {
            throw new IllegalStateException("No free port", e);
        }
    }

    @Override
    public void close() {
        if (process != null && process.isAlive()) {
            process.destroy();
            try {
                if (!process.waitFor(20, java.util.concurrent.TimeUnit.SECONDS)) {
                    process.destroyForcibly();
                }
            } catch (InterruptedException e) {
                Thread.currentThread().interrupt();
                process.destroyForcibly();
            }
        }
        try (var paths = Files.walk(workDir)) {
            paths.sorted(Comparator.reverseOrder()).map(Path::toFile).forEach(File::delete);
        } catch (IOException ignored) {
            // Best effort: the OS temp dir is outside the repository.
        }
    }
}
