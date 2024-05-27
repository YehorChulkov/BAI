import axios from 'axios';
import APIKeysConfig from '../APIKeysConfig';
import { ChatMessage } from '../types';

const MODEL_ID = 'ft:gpt-3.5-turbo-0613:rg-neuroinformatics:ft-hq-new-default:8sCkSlVq';
const TEMPERATURE = 0.3;

export const sendAudioToWhisper = async (
  filePath: string,
  setProcessedText: (text: string) => void,
  setResponseOptions: (responseOptions: string[]) => void,
  setCategory: (category: string) => void,
  setWaitingForResponse: (waitingForResponse: boolean) => void,
  language: string,
  setError: (error: string) => void,
  chatHistory: ChatMessage[]
) => {
  setError('');
  const fileUri = 'file://' + filePath;
  const formData = new FormData();
  formData.append('file', {
    uri: fileUri,
    type: 'audio/mp3',
    name: 'recording.mp3',
  });
  formData.append('model', 'whisper-1');
  formData.append('response_format', 'text');
  const supportedLanguages = ['en', 'de']
  if (!supportedLanguages.includes(language)) {
    language = 'en';
  }
  formData.append('language', language);

  setWaitingForResponse(true);

  try {
    const response = await axios({
      method: 'post',
      url: 'https://api.openai.com/v1/audio/transcriptions',
      data: formData,
      headers: {
        Authorization: `Bearer ${APIKeysConfig.openAI}`,
        'Content-Type': 'multipart/form-data',
      },
    });
    const transcript = response.data;
    setProcessedText(transcript);
    generateResponseOptions(transcript, setResponseOptions, setCategory, setWaitingForResponse, chatHistory);
    console.log('Transcript: ', transcript);
  } catch (error) {
    setError(`Error processing audio file, ${error}`);
    console.error('Error processing audio file:', error);
  }
};

const sendMessageToChatGPT = async (
  messages: {role: string; content: string}[],
  setWaitingForResponse: (waitingForResponse: boolean) => void,
  useFineTunedModel: boolean = false
) => {
  try {
    setWaitingForResponse(true);
    const response = await axios({
      method: 'post',
      url: 'https://api.openai.com/v1/chat/completions',
      headers: {
        Authorization: `Bearer ${APIKeysConfig.openAI}`,
        'Content-Type': 'application/json',
      },
      data: {
        model: useFineTunedModel ? MODEL_ID : 'gpt-4o',
        messages: messages,
        temperature: useFineTunedModel ? TEMPERATURE : 1,
        max_tokens: 150,
        n: 1,
        stop: null,
      },
    });
    console.log('Response: ', response.data.choices);
    const options = response.data.choices[0].message.content;
    return options;
  } catch (error) {
    console.error('Error generating response options:', error);
  }
};


const generateResponseOptions = async (
  transcript: string,
  setResponseOptions: (options: string[]) => void,
  setCategory: (category: string) => void,
  setWaitingForResponse: (waitingForResponse: boolean) => void,
  chatHistory: ChatMessage[]
) => {
  console.log("chatHistory: ", chatHistory)
  const historyMessages = constructMessage(chatHistory);
  const prompt = `Generate N keywords that might help a speech-impaired person respond to a given question. The keywords should be as short as possible and only describe one possible answer each. Provide answers which are as different as possible and try to include every viewpoint in the answers. For example if one of the answers is yes, also include no, and when one of the answers is good, also include bad. When the question is asking for a day or time, be specific in your suggested answers. In addition to suggesting answers, also provide the category of what the question is asking for. For example, if the question is asking for the name of a person, the category should be NAME. If the question is asking for an address or street name, the category should be ADDRESS. Here are some examples:

  Example 1:
  Question: How was your day?
  N: 6
  Answers: 1. Good; 2. Fantastic; 3. Bad; 4. Horrible; 5. Splendid; 6. Boring
  Category: ADJECTIVE
  Example 2:
  Question: How many people are living in your household?
  N: 10
  Answers: 1. 1; 2. 2; 3. 3; 4. 4; 5. 5; 6. 6; 7. 7; 8. 8; 9. 9; 10. 10
  Category: NUMBER
  Example 3:
  Question: What is your mother's name?
  N: 4
  Answers: 1. Rose; 2. Mary; 3. Miriam; 4. Joanna
  Category: NAME
  Example 4:
  Question: Are you hungry?
  N: 3
  Answers: 1. Yes; 2. No; 3. Very
  Category: YESNO
  
  N = 6

  ALWAYS provide the answers as a list of SINGLE words, not numerated and separated by comma. Here is an example of a response: "Answers: Good, Bad, Great, Terrible, Okay, Tired
  Category: ADJECTIVE". This format of the response has to be like this all the times without exceptions. Take the conversation history into account, if provided.
  `;
  const messages = [
          {
            role: 'system',
            content: prompt,
          },
          ...historyMessages,
          {
            role: 'system',
            content: 'Here is the question:',
          },
          {
            role: 'user',
            content: transcript,
          },
        ];
    const response = await sendMessageToChatGPT(messages, setWaitingForResponse);
    try {
      const { options, category } = parseResponse(response);
      // const options = response.split(',').map((option: string) => option.trim());
      setResponseOptions(options);
      setCategory(category);
      setWaitingForResponse(false);
    } catch (error) {
      generateResponseOptions(transcript, setResponseOptions, setCategory, setWaitingForResponse, chatHistory);
    }

  };

 


export const regenerateResponseOptions = async (
  originalRequest: string,
  providedResponse: string[],
  setResponseOptions: (options: string[]) => void,
  setCategory: (category: string) => void,
  setWaitingForResponse: (waitingForResponse: boolean) => void,
  chatHistory: ChatMessage[]
) => {
  chatHistory.push({ role: 'User', text: `Your provided keywords: ${providedResponse}. Pease generate new keywords that don't repeat the previous once.` });
  generateResponseOptions(originalRequest, setResponseOptions, setCategory, setWaitingForResponse, chatHistory);
};


export const generateFullResponse = async (questionArg: string, answer: string, setFullResponse: (fullResponse: string) => void, setWaitingForSpeechGeneration: (waitingForResponse: boolean) => void, chatHistory: ChatMessage[]) => {
  const formatedChatHistory = formatChatHistory(chatHistory);
  console.log("formatedChatHistory: ", formatedChatHistory)
    const prompt = `${formatedChatHistory}}
    Question: ${questionArg}
    Keywords: ${answer}
    Answer:\n\n###\n\n`
    const response = await sendMessageToChatGPT([{ role: 'user', content: prompt }], setWaitingForSpeechGeneration, true);
    const fullResponse = response.replace(/ END$/, '').trim();
    setFullResponse(fullResponse);
    setWaitingForSpeechGeneration(false);
};

export const generateAnswerForChangingTopic = async (
  originalRequest: string,
  providedResponse: string[],
  setFullResponse: (fullResponse: string) => void,
  setWaitingForSpeechGeneration: (waitingForSpeechGeneration: boolean) => void
) => {
    const messages = [
            {
              role: 'system',
              content:
              "You are a helpful assistant helping a disabled person to generate a full sentence based on a selected keyword. When generating responses, always adopt the perspective of the person who chose the response word, not the AI's perspective. The user has asked to change the topic. You should generate a complete sentece that indicates the intention to change the topic. Do not suggest any new topics, just show the wish to change it. Here is the original question you need to mention: ",
            },
            {
              role: 'user',
              content: originalRequest,
            },
    ];
    const response = await sendMessageToChatGPT(messages, setWaitingForSpeechGeneration);
    const fullResponse = response.trim();
    setFullResponse(fullResponse);
    setWaitingForSpeechGeneration(false);
};



export const fetchSpeech = async (text: string, voice: string) => {
  console.log("Text: ", text)
  return await axios.post(
    'https://api.openai.com/v1/audio/speech',
    {
      model: 'tts-1',
      voice: voice === 'male' ? 'echo' : 'nova',
      input: text,
    },
    {
      headers: {
        Authorization: `Bearer ${APIKeysConfig.openAI}`,
        'Content-Type': 'application/json',
      },
      responseType: 'arraybuffer',
    },
  );
};


const constructMessage = (chatHistory: ChatMessage[]) => {
  const startMarker = {
    role: 'user',
    content: 'Conversation history begin:',
  };

  const endMarker = {
    role: 'user',
    content: 'Conversation history end.',
  };

  const historyMessages = chatHistory.map(message => ({
    role: 'user',
    content: `${message.role}: ${message.text}`
  }));

  return [startMarker, ...historyMessages, endMarker];
}

const parseResponse = (responseContent: string) => {
  const answersMatch = responseContent.match(/Answers: ([\s\S]*?)\nCategory: ([\s\S]*)/);
  if (answersMatch) {
    const options = answersMatch[1].split(',').map(option => option.trim());
    const category = answersMatch[2].trim();
    return { options, category };
  } else {
    throw new Error('Response format is incorrect.');
  }
};


const formatChatHistory = (chatHistory: ChatMessage[]): string => {
  return chatHistory
    .map((message, index) => {
      if (message.role.toLowerCase() === 'user') {
        return `Answer: ${message.text.trim()}`;
      } else if (message.role.toLowerCase() === 'assistant') {
        return `Question: ${message.text.trim()}`;
      }
      return '';
    })
    .filter(Boolean)
    .join('\n');
};