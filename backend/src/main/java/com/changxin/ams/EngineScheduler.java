package com.changxin.ams;

import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;

@Component
@ConditionalOnProperty(name="ams.scheduling", havingValue="true", matchIfMissing=true)
public class EngineScheduler {
    private final Store store;
    private final AlarmEngine engine;
    public EngineScheduler(Store store, AlarmEngine engine) { this.store = store; this.engine = engine; }
    @Scheduled(fixedDelay=2000, initialDelay=3000)
    public void tick() { store.write(() -> { engine.tick(); return null; }); }
    @Scheduled(fixedDelay=300000, initialDelay=300000)
    public void scan() { store.write(() -> engine.scan(null)); }
}
