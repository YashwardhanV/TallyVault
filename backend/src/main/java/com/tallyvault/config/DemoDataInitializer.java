package com.tallyvault.config;

import org.springframework.boot.ApplicationArguments;
import org.springframework.boot.ApplicationRunner;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.stereotype.Component;

@Component
@ConditionalOnProperty(name = "tallyvault.demo-data-enabled", havingValue = "true")
public class DemoDataInitializer implements ApplicationRunner {
    private final DemoDataService demoData;
    public DemoDataInitializer(DemoDataService demoData) { this.demoData = demoData; }
    @Override public void run(ApplicationArguments args) { demoData.seedIfEmpty(); }
}

