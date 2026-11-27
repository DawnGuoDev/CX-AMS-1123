# veFaaS native/v1 runtime assets

`Dockerfile.java-vue` builds the CX-AMS image for 火山引擎 veFaaS (runtime `native/v1`).
veFaaS starts every function with `/opt/application/run.sh` and injects no shell or libc,
so the final image is assembled on `scratch` from explicit layers.

| File | Purpose |
| --- | --- |
| `run.sh` | veFaaS entrypoint (mode 0755); `exec /opt/java/bin/java -jar /app/ams.jar` |
| `busybox` | static x86-64 busybox 1.36.1, provides `/bin/sh` and applets such as `netstat`/`ip` |

`busybox` md5 `08966f19bb89b5e6de896680566cc322` is the same binary already running in
production (`cx-ams` function), so the image layout matches what has been verified there.
It comes from Alpine 3.20 `busybox-static-1.36.1-r31.apk` and is committed here because the
CP public build cluster cannot reliably fetch external URLs during image assembly.
