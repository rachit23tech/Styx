import mongoose from "mongoose";
import type { MongoMemoryServer } from "mongodb-memory-server";

let mongoServer: MongoMemoryServer | null = null;
let usingExternal = false;

/**
 * Connects mongoose to a throwaway database.
 * By default an in-memory MongoDB is started. Set TEST_MONGODB_URI to run
 * the tests against an existing server instead (a uniquely named database
 * is used and dropped afterwards).
 */
export async function startTestDb(): Promise<void> {
    const external = process.env.TEST_MONGODB_URI;
    if (external) {
        usingExternal = true;
        await mongoose.connect(external, { dbName: `styx_test_${process.pid}_${Date.now()}` });
        return;
    }
    const { MongoMemoryServer } = await import("mongodb-memory-server");
    mongoServer = await MongoMemoryServer.create();
    await mongoose.connect(mongoServer.getUri());
}

export async function stopTestDb(): Promise<void> {
    if (usingExternal) {
        await mongoose.connection.dropDatabase();
    }
    await mongoose.disconnect();
    if (mongoServer) {
        await mongoServer.stop();
        mongoServer = null;
    }
}
