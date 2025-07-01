// src/metrics-server.ts
import { createServer, IncomingMessage, ServerResponse } from "http";
import { registry } from "./metrics";

export class MetricsServer {
  private server: ReturnType<typeof createServer>;
  private port: number;

  constructor(port: number = 9464) {
    this.port = port;
    this.server = createServer(this.handleRequest.bind(this));
  }

  private async handleRequest(req: IncomingMessage, res: ServerResponse) {
    if (req.url === "/metrics" && req.method === "GET") {
      try {
        res.setHeader("Content-Type", registry.contentType);
        res.statusCode = 200;
        const metrics = await registry.metrics();
        res.end(metrics);
      } catch (error) {
        console.error("Error generating metrics:", error);
        res.statusCode = 500;
        res.end("Error generating metrics");
      }
    } else if (req.url === "/dashboard" && req.method === "GET") {
      try {
        res.setHeader("Content-Type", "text/html");
        res.statusCode = 200;
        const dashboard = await this.generateDashboard();
        res.end(dashboard);
      } catch (error) {
        console.error("Error generating dashboard:", error);
        res.statusCode = 500;
        res.end("Error generating dashboard");
      }
    } else if (req.url === "/health" && req.method === "GET") {
      res.setHeader("Content-Type", "application/json");
      res.statusCode = 200;
      res.end(
        JSON.stringify({
          status: "healthy",
          timestamp: new Date().toISOString(),
        })
      );
    } else {
      res.statusCode = 404;
      res.end("Not Found");
    }
  }

  private async generateDashboard(): Promise<string> {
    const metrics = await registry.metrics();
    const lines = metrics.split("\n");

    // Extract our 3 core metrics
    const sttMetrics = lines.filter((line) => line.includes("stt_duration_ms"));
    const llmMetrics = lines.filter((line) => line.includes("llm_duration_ms"));
    const ttsMetrics = lines.filter((line) => line.includes("tts_duration_ms"));

    // Parse histogram data for percentiles
    const parseHistogram = (metricLines: string[], metricName: string) => {
      const buckets = metricLines.filter((line) =>
        line.includes("_bucket{le=")
      );
      const count =
        metricLines.find((line) => line.includes("_count"))?.split(" ")[1] ||
        "0";
      const sum =
        metricLines.find((line) => line.includes("_sum"))?.split(" ")[1] || "0";

      const totalMs = parseFloat(sum);
      const requestCount = parseInt(count);
      const avgMs = requestCount > 0 ? Math.round(totalMs / requestCount) : 0;

      return {
        count: requestCount,
        average: avgMs,
        total: Math.round(totalMs),
      };
    };

    const sttData = parseHistogram(sttMetrics, "stt_duration_ms");
    const llmData = parseHistogram(llmMetrics, "llm_duration_ms");
    const ttsData = parseHistogram(ttsMetrics, "tts_duration_ms");

    // Helper function to format time
    const formatTime = (ms: number) => {
      if (ms === 0) return "0ms";
      if (ms < 1000) return `${ms}ms`;
      return `${(ms / 1000).toFixed(1)}s`;
    };

    // Helper function to get status
    const getStatus = (
      value: number,
      goodThreshold: number,
      warningThreshold: number
    ) => {
      if (value <= goodThreshold) return "good";
      if (value <= warningThreshold) return "warning";
      return "critical";
    };

    return `
<!DOCTYPE html>
<html>
<head>
    <title>Voice Bot Metrics Dashboard</title>
    <meta charset="utf-8">
    <meta http-equiv="refresh" content="5">
    <style>
        * { box-sizing: border-box; margin: 0; padding: 0; }
        body { 
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; 
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            min-height: 100vh;
            padding: 20px;
        }
        .container { 
            max-width: 1400px; 
            margin: 0 auto; 
        }
        .header { 
            text-align: center; 
            margin-bottom: 40px; 
            color: white;
        }
        .header h1 { 
            font-size: 2.5rem; 
            font-weight: 700; 
            margin-bottom: 10px;
            text-shadow: 0 2px 4px rgba(0,0,0,0.3);
        }
        .header .subtitle { 
            font-size: 1.1rem; 
            opacity: 0.9; 
            margin-bottom: 5px;
        }
        .header .timestamp { 
            font-size: 0.9rem; 
            opacity: 0.7;
        }
        .metrics-grid { 
            display: grid; 
            grid-template-columns: repeat(auto-fit, minmax(350px, 1fr)); 
            gap: 30px; 
            margin-bottom: 40px;
        }
        .metric-card { 
            background: rgba(255, 255, 255, 0.95);
            backdrop-filter: blur(10px);
            padding: 30px; 
            border-radius: 20px; 
            box-shadow: 0 8px 32px rgba(0,0,0,0.1);
            border: 1px solid rgba(255,255,255,0.2);
            transition: transform 0.3s ease, box-shadow 0.3s ease;
        }
        .metric-card:hover {
            transform: translateY(-5px);
            box-shadow: 0 12px 40px rgba(0,0,0,0.15);
        }
        .metric-header {
            display: flex;
            align-items: center;
            margin-bottom: 20px;
        }
        .metric-icon {
            font-size: 2rem;
            margin-right: 15px;
        }
        .metric-title { 
            font-size: 1.3rem; 
            font-weight: 600; 
            color: #2d3748;
        }
        .metric-value { 
            font-size: 3rem; 
            font-weight: 800; 
            margin-bottom: 8px;
            line-height: 1;
        }
        .metric-label { 
            font-size: 0.9rem; 
            color: #718096; 
            margin-bottom: 20px;
            text-transform: uppercase;
            letter-spacing: 0.5px;
        }
        .metric-stats { 
            display: grid; 
            grid-template-columns: 1fr 1fr; 
            gap: 15px;
        }
        .stat { 
            background: rgba(74, 85, 104, 0.05);
            padding: 15px; 
            border-radius: 12px; 
            text-align: center;
        }
        .stat-label { 
            font-size: 0.8rem; 
            color: #718096; 
            margin-bottom: 5px;
            text-transform: uppercase;
            letter-spacing: 0.3px;
        }
        .stat-value { 
            font-size: 1.2rem; 
            font-weight: 700; 
            color: #2d3748;
        }
        .footer {
            text-align: center;
            padding: 30px;
            color: rgba(255,255,255,0.8);
            border-top: 1px solid rgba(255,255,255,0.1);
            margin-top: 40px;
        }
        .footer a {
            color: rgba(255,255,255,0.9);
            text-decoration: none;
            margin: 0 15px;
            padding: 8px 16px;
            border-radius: 20px;
            background: rgba(255,255,255,0.1);
            transition: background 0.3s ease;
        }
        .footer a:hover {
            background: rgba(255,255,255,0.2);
        }
        .status-good { 
            background: linear-gradient(135deg, #68d391 0%, #38a169 100%);
        }
        .status-good .metric-value { color: white; }
        .status-warning { 
            background: linear-gradient(135deg, #f6ad55 0%, #ed8936 100%);
        }
        .status-warning .metric-value { color: white; }
        .status-critical { 
            background: linear-gradient(135deg, #fc8181 0%, #e53e3e 100%);
        }
        .status-critical .metric-value { color: white; }
        .status-indicator {
            display: inline-block;
            width: 12px;
            height: 12px;
            border-radius: 50%;
            margin-right: 8px;
        }
        .indicator-good { background: #48bb78; }
        .indicator-warning { background: #ed8936; }
        .indicator-critical { background: #e53e3e; }
        .no-data {
            opacity: 0.6;
        }
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <h1>Voice Bot Performance Dashboard</h1>
            <p class="subtitle">Real-time metrics • Auto-refreshes every 5 seconds</p>
            <p class="timestamp">Last updated: ${new Date().toLocaleString()}</p>
        </div>
        
        <div class="metrics-grid">
            <div class="metric-card status-${getStatus(
              sttData.average,
              1000,
              2000
            )} ${sttData.count === 0 ? "no-data" : ""}">
                <div class="metric-header">
                    <div class="metric-icon">🎯</div>
                    <div class="metric-title">Speech-to-Text</div>
                </div>
                <div class="metric-value">${formatTime(sttData.average)}</div>
                <div class="metric-label">Average Processing Time</div>
                <div class="metric-stats">
                    <div class="stat">
                        <div class="stat-label">Total Requests</div>
                        <div class="stat-value">${sttData.count}</div>
                    </div>
                    <div class="stat">
                        <div class="stat-label">Total Time</div>
                        <div class="stat-value">${formatTime(
                          sttData.total
                        )}</div>
                    </div>
                </div>
            </div>
            
            <div class="metric-card status-${getStatus(
              llmData.average,
              3000,
              5000
            )} ${llmData.count === 0 ? "no-data" : ""}">
                <div class="metric-header">
                    <div class="metric-icon">🧠</div>
                    <div class="metric-title">LLM Response</div>
                </div>
                <div class="metric-value">${formatTime(llmData.average)}</div>
                <div class="metric-label">Average Response Time</div>
                <div class="metric-stats">
                    <div class="stat">
                        <div class="stat-label">Total Requests</div>
                        <div class="stat-value">${llmData.count}</div>
                    </div>
                    <div class="stat">
                        <div class="stat-label">Total Time</div>
                        <div class="stat-value">${formatTime(
                          llmData.total
                        )}</div>
                    </div>
                </div>
            </div>
            
            <div class="metric-card status-${getStatus(
              ttsData.average,
              3000,
              5000
            )} ${ttsData.count === 0 ? "no-data" : ""}">
                <div class="metric-header">
                    <div class="metric-icon">🔊</div>
                    <div class="metric-title">Text-to-Speech</div>
                </div>
                <div class="metric-value">${formatTime(ttsData.average)}</div>
                <div class="metric-label">Average Synthesis Time</div>
                <div class="metric-stats">
                    <div class="stat">
                        <div class="stat-label">Total Requests</div>
                        <div class="stat-value">${ttsData.count}</div>
                    </div>
                    <div class="stat">
                        <div class="stat-label">Total Time</div>
                        <div class="stat-value">${formatTime(
                          ttsData.total
                        )}</div>
                    </div>
                </div>
            </div>
        </div>
        
        <div class="footer">
            <p style="margin-bottom: 15px;">
                <span class="status-indicator indicator-good"></span>Good (STT &lt;1s, LLM/TTS &lt;3s) • 
                <span class="status-indicator indicator-warning"></span>Warning • 
                <span class="status-indicator indicator-critical"></span>Critical
            </p>
            <div>
                <a href="/metrics">Raw Prometheus Metrics</a>
                <a href="/health">Health Check</a>
            </div>
        </div>
    </div>
</body>
</html>
    `;
  }

  start(): Promise<void> {
    return new Promise((resolve) => {
      this.server.listen(this.port, () => {
        console.log(`📊 Metrics server started:`);
        console.log(`   • Dashboard: http://localhost:${this.port}/dashboard`);
        console.log(`   • Raw metrics: http://localhost:${this.port}/metrics`);
        resolve();
      });
    });
  }

  stop(): Promise<void> {
    return new Promise((resolve) => {
      this.server.close(() => {
        console.log("📊 Metrics server stopped");
        resolve();
      });
    });
  }
}
