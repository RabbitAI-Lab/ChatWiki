export async function register() {
  if (process.env.NEXT_RUNTIME === "nodejs" && process.env.NEXT_PHASE !== "phase-production-build") {
    const { initDb } = await import("./db");
    await initDb();

    const { startMcpServer } = await import("./mcp-server");
    startMcpServer();

    // 初始化支付提供商
    try {
      const { initProviders } = await import("./lib/payment");
      initProviders();
    } catch (err) {
      console.error("[instrumentation] Failed to init payment providers:", err);
    }

    // 启动通知调度器
    try {
      const { startNotificationScheduler } = await import("./lib/payment/scheduler");
      startNotificationScheduler();
    } catch (err) {
      console.error("[instrumentation] Failed to start notification scheduler:", err);
    }
  }
}
