const { Pinecone } = require("@pinecone-database/pinecone");

let index;

const initializePinecone = async () => {
  const pinecone = new Pinecone({
    apiKey: process.env.PINECONE_API_KEY
  });

  index = await pinecone.index('user-interests');
  console.log("Pinecone initialized and index selected!");
  // console.log(index);
  
};

const removeUserVector = async (userId) => {
  try {
    const res = await index.fetch([userId], { namespace: '' }); // Explicitly using default namespace
    if (res?.records?.[userId]) {
      await index.deleteOne(userId, { namespace: '' });
      console.log(`User vector removed for userId: ${userId}`);
    } else {
      console.log(`No vector found for userId: ${userId}`);
    }
  } catch (error) {
    console.error(`Error removing user vector for userId: ${userId}`, error);
  }
};

module.exports = {
  initializePinecone,
  getIndex: () => index,
  removeUserVector
};
