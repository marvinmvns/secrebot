const { MongoClient } = require('mongodb');
const config = require('../config/config');

class AnalyticsService {
    constructor() {
        this.db = null;
        this.client = null;
        this.collections = {
            analytics: 'chat_analytics',
            interactions: 'chat_interactions'
        };
    }

    async connect() {
        if (!this.client) {
            this.client = new MongoClient(config.MONGODB_URI);
            await this.client.connect();
            this.db = this.client.db(config.DB_NAME);
            await this.ensureCollections();
        }
        return this.db;
    }

    async ensureCollections() {
        try {
            const collections = await this.db.listCollections().toArray();
            const existingCollections = collections.map(c => c.name);

            if (!existingCollections.includes(this.collections.analytics)) {
                await this.createAnalyticsCollection();
            }

            if (!existingCollections.includes(this.collections.interactions)) {
                await this.createInteractionsCollection();
            }
        } catch (error) {
            console.error('Error ensuring collections:', error);
            throw error;
        }
    }

    async createAnalyticsCollection() {
        const collection = this.db.collection(this.collections.analytics);
        
        await collection.createIndexes([
            { key: { phoneNumber: 1 }, unique: true },
            { key: { lastInteraction: -1 } },
            { key: { platform: 1 } },
            { key: { totalMessages: -1 } }
        ]);

        console.log('Created chat_analytics collection with indexes');
    }

    async createInteractionsCollection() {
        const collection = this.db.collection(this.collections.interactions);
        
        await collection.createIndexes([
            { key: { phoneNumber: 1, timestamp: -1 } },
            { key: { platform: 1, timestamp: -1 } },
            { key: { messageType: 1 } },
            { key: { sessionId: 1 } },
            { key: { timestamp: -1 } }
        ]);

        console.log('Created chat_interactions collection with indexes');
    }

    async recordInteraction(interactionData) {
        await this.connect();
        const {
            phoneNumber,
            platform,
            messageType,
            messageContent,
            direction,
            sessionId,
            flowId,
            nodeId,
            metadata = {}
        } = interactionData;

        const interaction = {
            phoneNumber,
            platform,
            messageType,
            messageContent,
            direction,
            sessionId,
            flowId,
            nodeId,
            metadata,
            timestamp: new Date()
        };

        await this.db.collection(this.collections.interactions).insertOne(interaction);
        await this.updateAnalytics(phoneNumber, platform);
    }

    async updateAnalytics(phoneNumber, platform) {
        const analyticsCollection = this.db.collection(this.collections.analytics);
        
        const result = await analyticsCollection.findOneAndUpdate(
            { phoneNumber },
            {
                $inc: { totalMessages: 1 },
                $set: { 
                    lastInteraction: new Date(),
                    platform 
                },
                $setOnInsert: {
                    phoneNumber,
                    firstInteraction: new Date(),
                    totalSessions: 1
                }
            },
            { 
                upsert: true, 
                returnDocument: 'after' 
            }
        );

        return result.value;
    }

    async incrementSession(phoneNumber) {
        await this.connect();
        const analyticsCollection = this.db.collection(this.collections.analytics);
        
        await analyticsCollection.updateOne(
            { phoneNumber },
            { $inc: { totalSessions: 1 } }
        );
    }

    async getAnalyticsSummary() {
        await this.connect();
        const analyticsCollection = this.db.collection(this.collections.analytics);
        
        const [
            totalUsers,
            totalMessages,
            whatsappUsers,
            telegramUsers,
            topUsers,
            dailyStats
        ] = await Promise.all([
            analyticsCollection.countDocuments(),
            analyticsCollection.aggregate([
                { $group: { _id: null, total: { $sum: '$totalMessages' } } }
            ]).toArray(),
            analyticsCollection.countDocuments({ platform: 'whatsapp' }),
            analyticsCollection.countDocuments({ platform: 'telegram' }),
            analyticsCollection.find().sort({ totalMessages: -1 }).limit(10).toArray(),
            this.getDailyStats()
        ]);

        return {
            totalUsers,
            totalMessages: totalMessages[0]?.total || 0,
            platformStats: {
                whatsapp: whatsappUsers,
                telegram: telegramUsers
            },
            topUsers,
            dailyStats
        };
    }

    async getDailyStats(days = 30) {
        await this.connect();
        const interactionsCollection = this.db.collection(this.collections.interactions);
        
        const startDate = new Date();
        startDate.setDate(startDate.getDate() - days);

        const pipeline = [
            {
                $match: {
                    timestamp: { $gte: startDate }
                }
            },
            {
                $group: {
                    _id: {
                        date: { $dateToString: { format: "%Y-%m-%d", date: "$timestamp" } },
                        platform: "$platform"
                    },
                    messages: { $sum: 1 },
                    uniqueUsers: { $addToSet: "$phoneNumber" }
                }
            },
            {
                $group: {
                    _id: "$_id.date",
                    platforms: {
                        $push: {
                            platform: "$_id.platform",
                            messages: "$messages",
                            users: { $size: "$uniqueUsers" }
                        }
                    },
                    totalMessages: { $sum: "$messages" }
                }
            },
            {
                $sort: { _id: 1 }
            }
        ];

        return await interactionsCollection.aggregate(pipeline).toArray();
    }

    async getUserInteractions(phoneNumber, limit = 100, offset = 0) {
        await this.connect();
        const interactionsCollection = this.db.collection(this.collections.interactions);
        
        return await interactionsCollection
            .find({ phoneNumber })
            .sort({ timestamp: -1 })
            .skip(offset)
            .limit(limit)
            .toArray();
    }

    async getPlatformStats() {
        await this.connect();
        const analyticsCollection = this.db.collection(this.collections.analytics);
        
        const pipeline = [
            {
                $group: {
                    _id: "$platform",
                    users: { $sum: 1 },
                    totalMessages: { $sum: "$totalMessages" },
                    avgMessages: { $avg: "$totalMessages" }
                }
            }
        ];

        return await analyticsCollection.aggregate(pipeline).toArray();
    }

    async getMessageTypeStats() {
        await this.connect();
        const interactionsCollection = this.db.collection(this.collections.interactions);
        
        const pipeline = [
            {
                $group: {
                    _id: "$messageType",
                    count: { $sum: 1 }
                }
            },
            {
                $sort: { count: -1 }
            }
        ];

        return await interactionsCollection.aggregate(pipeline).toArray();
    }

    async close() {
        if (this.client) {
            await this.client.close();
            this.client = null;
            this.db = null;
        }
    }
}

module.exports = new AnalyticsService();