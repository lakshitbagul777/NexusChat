const { Router } = require('express')
const { generateEmbedding } = require('../utils/embedder.js')
const { getIndex } = require('../services/pineconeService.js')
const { updateUserStatus, getOnlineUsers } = require('../signaling/signalServer.js')
const router = Router();
// const index = getIndex();

// if (!index) {
//     console.error('Pinecone index is not initialized!');
// }

// console.log('Index: ', index);

router.post('/save-interests', async (req, res) => {

    const index = getIndex();

    const { userId, interests } = req.body;

    if (!userId || !interests) {
        return res.status(400).json({ msg: 'Invalid userId or interests' });
    }

    try {
        const interestVector = await generateEmbedding(interests);
        console.log(interestVector.length);

        await index.upsert(
            [
                {
                    id: userId,
                    values: interestVector,
                    metadata: { userId }
                },
            ]
        );

        console.log(`interests upserted successfully for ${userId}`);

        res.status(200).json({ msg: 'Interests saved successfully' });
    } catch (error) {
        console.error('Error saving interests:', error);
        res.status(500).json({ msg: 'Failed to save interests' });
    }
});

router.post('/meet', async function (req, res) {
    index = getIndex();
    try {
        const { userId } = req.body;

        if (!userId) {
            return res.status(400).json({ message: 'User ID is required' });
        }

        updateUserStatus(userId, { available: true });

        // Get the current pool of online users
        const onlineUsers = await getOnlineUsers(userId);
        console.log(onlineUsers);
        

        // if (!onlineUsers || !onlineUsers.length) {
        //     return res.status(404).json({ message: 'No online users available' });
        // }

        // Query Pinecone for top 10 similar users among online users
        const queryResponse = await index.query({
            id: userId,
            topK: 10,
            includeMetadata: true,
            filter: {
                'userId': { "$in": onlineUsers } // Only search among currently online users
            }
        });

        const matches = queryResponse.matches

        console.log(matches);


        res.status(200).json({ matches });

    } catch (error) {
        console.error('Error in /meet route:', error);
        res.status(500).json({ message: 'Internal server error' });
    }
});

module.exports = router;