import { createRxDatabase, addRxPlugin } from 'rxdb';
import { getRxStorageDexie } from 'rxdb/plugins/storage-dexie';
import { RxDBQueryBuilderPlugin } from 'rxdb/plugins/query-builder';
import { RxDBJsonDumpPlugin } from 'rxdb/plugins/json-dump';

// Add plugins
addRxPlugin(RxDBQueryBuilderPlugin);
addRxPlugin(RxDBJsonDumpPlugin);

// Schemas
const portfolioSchema = {
    title: 'portfolio schema',
    version: 0,
    primaryKey: 'id',
    type: 'object',
    properties: {
        id: { type: 'string', maxLength: 100 },
        name: { type: 'string' },
        description: { type: 'string' },
        target_allocation: { type: 'object' }, // Symbol -> Target Weight
    },
    required: ['id', 'name']
};

const transactionSchema = {
    title: 'transaction schema',
    version: 0,
    primaryKey: 'id',
    type: 'object',
    properties: {
        id: { type: 'string', maxLength: 100 },
        portfolio_id: { type: 'string' },
        symbol: { type: 'string' },
        type: { type: 'string' }, // BUY, SELL, DIVIDEND
        date: { type: 'string' },
        shares: { type: 'number' },
        price: { type: 'number' },
        fee: { type: 'number' },
        currency: { type: 'string' }
    },
    required: ['id', 'portfolio_id', 'symbol', 'type', 'date', 'shares', 'price']
};

// Singleton DB instance
let dbPromise = null;

export const getDatabase = async () => {
    if (dbPromise) return dbPromise;
    
    const createDb = async () => {
        try {
            const db = await createRxDatabase({
                name: 'novaportfolio_local',
                storage: getRxStorageDexie(),
                multiInstance: true,          // Allow multiple tabs to sync
                closeDuplicates: true         // Automatically close previous instances if React HMR reloads
            });

            await db.addCollections({
                portfolios: { schema: portfolioSchema },
                transactions: { schema: transactionSchema }
            });

            // Initialize a default portfolio if none exists
            const portCount = await db.portfolios.find().exec();
            if (portCount.length === 0) {
                await db.portfolios.insert({
                    id: 'main-local-portfolio',
                    name: 'Main Portfolio',
                    description: 'Local Offline Portfolio',
                    target_allocation: {}
                });
            }
            
            return db;
        } catch (err) {
            console.error("RxDB Initialization Error: ", err);
            throw err;
        }
    };
    
    dbPromise = createDb();
    return dbPromise;
};
