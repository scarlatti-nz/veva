import { zodResponseFormat } from "openai/helpers/zod";
import { z } from "zod";
import OpenAI from "openai";
export function getAssessTranscript(tools, questions) {
    const assessTool = tools.find(tool => tool.definition.name === "assess_answers");
    if (!assessTool) {
        console.warn("No assess_answers tool found in tools array");
        return null;
    }

    const openai = new OpenAI({
        apiKey: process.env.OPENAI_API_KEY,
    });

    const answersFormat = z.object(Object.fromEntries(questions.map(q => [`answer${q.id.toUpperCase()}`, z.string()])));

    return async (transcript) => {
        const answersResponse = await openai.beta.chat.completions.parse({
            model: "gpt-4o",
            temperature: 0,
            messages: [
                {
                    role: "system", content: `Extract the answers to the following questions from the transcript provided. If no answer is provided for a question, return 'No answer provided'. Return the answers in a JSON array.
            ${questions.map(q => `Question ${q.id}: ${q.text}`).join("\n")}
            ` },
                {
                    role: "user", content: `Exam transcript: ${transcript}`
                }]
            ,
            response_format: zodResponseFormat(answersFormat, "answers")
        })
        console.log("answers response", answersResponse.choices[0].message.content);
        const answers = JSON.parse(answersResponse.choices[0].message.content);
        console.log("answers", answers);
        const assessment = await assessTool.callable(answers);
        return assessment;
    }
}
