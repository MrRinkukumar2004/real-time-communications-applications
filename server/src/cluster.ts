/**
 * Phase 9: Cluster Mode — Run multiple Socket.IO server instances
 *
 * This uses Node.js cluster module to fork multiple worker processes.
 * Each worker runs its own HTTP + Socket.IO server on a different port.
 * The Redis adapter synchronizes events between all workers.
 *
 * Architecture:
 *   ┌─────────────────────────────────────────────┐
 *   │              Primary Process                 │
 *   │         (orchestrates workers)               │
 *   └──────┬──────────┬──────────┬────────────────┘
 *          │          │          │
 *    ┌─────▼─────┐ ┌──▼──────┐ ┌▼──────────┐
 *    │ Worker 1  │ │ Worker 2│ │ Worker 3  │
 *    │ :3000     │ │ :3001   │ │ :3002     │
 *    │ Socket.IO │ │ Socket.IO│ │ Socket.IO │
 *    └─────┬─────┘ └──┬──────┘ └┬──────────┘
 *          │          │          │
 *    ┌─────▼──────────▼──────────▼──────────┐
 *    │            Redis (pub/sub)            │
 *    │    Syncs events across workers        │
 *    └──────────────────────────────────────┘
 */

import cluster from 'node:cluster';
import { availableParallelism } from 'node:os';

const NUM_WORKERS = Math.min(availableParallelism(), 3); // Cap at 3 for learning
const BASE_PORT = 3000;

if (cluster.isPrimary) {
    console.log(`\n[cluster] Primary process ${process.pid} starting ${NUM_WORKERS} workers...\n`);

    for (let i = 0; i < NUM_WORKERS; i++) {
        const worker = cluster.fork({ PORT: String(BASE_PORT + i) });
        console.log(`[cluster] Worker ${worker.process.pid} assigned to port ${BASE_PORT + i}`);
    }

    cluster.on('exit', (worker, code, signal) => {
        console.log(`[cluster] Worker ${worker.process.pid} died (code: ${code}, signal: ${signal}). Restarting...`);
        cluster.fork({ PORT: String(BASE_PORT) }); // Restart on the base port
    });

    console.log(`\n[cluster] All workers started. Open these URLs to test cross-server communication:`);
    for (let i = 0; i < NUM_WORKERS; i++) {
        console.log(`  - http://localhost:${BASE_PORT + i}`);
    }
    console.log(`\n[cluster] Messages sent on one port will appear on ALL ports via Redis!\n`);
} else {
    // Each worker imports and runs the full server
    import('./server.js');
    console.log(`[worker] Worker ${process.pid} starting on port ${process.env.PORT}...`);
}
