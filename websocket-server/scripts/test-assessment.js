import OpenAI from "openai";
import { getTools } from "../chatbots/dtl.js";
import dotenv from "dotenv";
import { connectWithRetry } from "../lib/weaviate-schema.js";
// Load environment variables
dotenv.config();

const weaviateClient = await connectWithRetry({
    httpHost: 'localhost',
    httpPort: 8087,
    grpcHost: 'localhost',
    grpcPort: 50051,
});

async function testAssessment() {
    // Example answers that demonstrate different levels of understanding
    const testAnswers = {
        answerQ1: `One of the most likely issues to arise during a contract milking term would be disagreements about milk production targets and the inputs required to achieve them. For example, there might be different expectations about the amount of supplementary feed needed, or disagreements about fertilizer application timing and quantities.`,
        
        answerQ1B: `The contract should clearly specify the agreed production targets, including seasonal variations, and outline the specific inputs that will be provided. It should detail who is responsible for feed decisions and include a process for reviewing and adjusting targets if conditions change significantly.`,
        
        answerQ2A: `I would seek help from:
1. Federated Farmers for contract interpretation and rights
2. A farm consultant or DairyNZ advisor for technical farming matters
3. An accountant for financial implications`,
        
        answerQ2B: `These sources are important because:
- Federated Farmers has specific expertise in agricultural contracts and can provide legal guidance
- Farm consultants understand the practical aspects of dairy farming and can provide evidence-based solutions
- Accountants can assess the financial impact of different solutions and ensure compliance`,
        
        answerQ3: `To prepare for contract negotiations, I would:
1. Review past production data and financial records
2. Get market rates for contract milking in the area
3. Calculate detailed budgets for different scenarios
4. Have my accountant review the financial terms
5. Get legal advice on the contract terms
6. Document my track record and achievements
7. Prepare a list of required equipment and resources`
    };

    try {
        // Get the tools with your OpenAI API key
        const tools = getTools(process.env.OPENAI_API_KEY, weaviateClient);
        
        // Find the assess_answers tool
        const assessTool = tools.find(tool => tool.definition.name === "assess_answers");
        
        if (!assessTool) {
            throw new Error("Could not find assess_answers tool");
        }

        console.log("Starting assessment with test answers...");
        
        // Call the assess_answers function
        const result = await assessTool.callable(testAnswers);
        
        // Pretty print the results
        console.log("\nAssessment Results:");
        console.log("==================");
        
        result.questions.forEach(question => {
            console.log(`\nQuestion ID: ${question.questionId}`);
            console.log(`Grade: ${question.grade}`);
            console.log(`Confidence: ${question.confidence}%`);
            console.log(`Feedback: ${question.feedback}`);
        });

    } catch (error) {
        console.error("Error running assessment test:", error);
    }
}

// Run the test
testAssessment().then(() => console.log("\nTest completed")).catch(console.error); 