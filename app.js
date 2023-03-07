/**
 * @param {import('probot').Probot} app
 */

const { Configuration, OpenAIApi } = require("openai");
const request = require('request');
var config=require('./src/config.js');


module.exports = (app) => {
  app.log("Wow! The app was loaded!");

  config.chatGPTKey=process.env.GPT_KEY;

  app.on("issues.opened", async (context) => {
    return context.octokit.issues.createComment(
        context.issue({ body: "Hello, I am CharRepo🤖️. What can I do for you?\n If you want me to answer questions about this repo, please use：/chatrepo [you question]." })
    );
  });


  app.on("issue_comment.created", async (context) => {
    if (context.isBot) return;


    if(context.payload.comment.body.startsWith(config.botName)){
      readmeAndKeyword(context,app);

    }
    else if(context.payload.comment.body.startsWith("/Bot")){

      const configuration = new Configuration({
        apiKey: config.chatGPTKey,
      });
      const openai = new OpenAIApi(configuration);

      var msg=context.payload.comment.body.substring(4);

      app.log.info("Msg:"+msg);
      const completion = await openai.createCompletion({
        model: "text-davinci-003",
        prompt:msg,
        max_tokens: 250,
        temperature: 0.9,
      });
      app.log.info(completion.data.choices[0].text);

      const issueComment = context.issue({
        body: completion.data.choices[0].text,
      });

      return context.octokit.issues.createComment(issueComment);
    }


    // return context.octokit.issues.createComment(
    //     context.issue({ body: "Ok!" })
    // );

  })


};

function readmeAndKeyword(context,app){

  var repo_name=context.payload.repository.name;
  var full_name=context.payload.repository.full_name;

  // 获取readme 文件
  // https://api.github.com/repos/【owner】/【repo name】/readme
  var url="https://api.github.com/repos/"+full_name+"/readme";
  var readme=""
  request(url, { json: true , headers:{'User-Agent': 'request'} }, (err, res, body) => {
    if (err) {
      return console.log(err);
    }
    //app.log.info("content:"+body.content);
    const buff = Buffer.from(JSON.stringify(body.content), 'base64');
    readme=buff.toString('utf-8');

    getKeyWords(context,app,readme);

  });

}


async function getKeyWords(context,app,readme){
  //app.log.info("Readme:"+readme);

  var readme_prompts=config.readme_prompts;
  var key_word_promts=config.key_word_promts;

  var question=context.payload.comment.body;
  var full_name=context.payload.repository.full_name;

  app.log.info(question.substring( config.botName.length ));

  const configuration = new Configuration({
    apiKey: config.chatGPTKey,
  });
  const openai = new OpenAIApi(configuration);


  // 构造序列
  // [readprompt,readme,key_word_promts,question]
  var msg=[];
  for(var i=0;i<readme_prompts.length;i++){
    msg.push(
        {"role": "system", "content": readme_prompts[i]}
    );
  }
  msg.push(
      {"role": "assistant", "content": readme}
  );
  for(var i=0;i<key_word_promts.length;i++){
    msg.push(
        {"role": "system", "content": key_word_promts[i]}
    );
  }
  msg.push(
      {"role": "user", "content": question.substring( config.botName.length )}
  );

  // 获取关键词，返回
  // const completion = await openai.createChatCompletion({
  //    model: "text-davinci-003",
  //    //prompt: question.substring( config.botName.length ),
  //    messages:msg.toString(),
  //    max_tokens: 1000
  // });


  //app.log.info(msg);
  const completion = await openai.createChatCompletion({
    model: "gpt-3.5-turbo",
    messages: msg,
  })

  //app.log.info(completion.data.choices[0].message.content);
  search(context,
      app,
      completion.data.choices[0].message.content,
      full_name,
      msg);

  //app.log.info("======");
  // app.log.info(completion);
  //app.log.info(completion.data.choices[0].message.content);
  //app.log.info("======");
  //return completion.data.choices[0].text;

}

function search(context,app,keyword_raw,full_name,msg){
  app.log.info("keywords:"+keyword_raw);

  // 修正keyword的格式
  var keywords=keyword_raw;

  //搜索repo
  var url="https://api.github.com/search/code?q="+keywords+"+in:file+repo:"+full_name;
  app.log.info(url);
  request(url, { json: true , headers:{'User-Agent': 'request','Accept': 'application/vnd.github.text-match+json'} }, (err, res, body) => {
    app.log.info(body)


    var prompt="";
    prompt+="Github search results\n";
    prompt+="Found "+body.items.length+" results\n\n";

    for(var i=0;i<body.items.length;i++){
      var item=body.items[i];
      // f"[{j + 1}] Name: {item['name']}" + f" Path: {item['path']}" + f" URL: {item['html_url']}"
      // f"[{j + 1}] Title: {item['title']}" + f" URL: {item['html_url']}"

      if(item.hasOwnProperty("name")){
        prompt+="["+i+1+"] Name:"+item.name+" Path:"+item.path+" URL:"+item.html_url+"\n";
      }
      else{
        prompt+="["+i+1+"] Title:"+item.title+" URL:"+item.html_url+"\n";
      }


    }

    prompt+="\n";
    prompt+="Instructions: Using the provided Github Code search results, write a comprehensive reply to the given query. Make sure to cite results using [[number](URL)] notation after the reference. If the provided search results refer to multiple subjects with the same name, write separate answers for each subject.\n"

    app.log.info(prompt);
    getOutput(context,app,prompt,msg);
  });


}

async function getOutput(context,app,prompt,msg){


  const configuration = new Configuration({
    apiKey: config.chatGPTKey,
  });
  const openai = new OpenAIApi(configuration);

  // msg.splice(msg.length-1,1);
  // msg.push([
  //   {"role": "user", "content": prompt}
  // ]);

  // const completion = await openai.createChatCompletion({
  //   model: "gpt-3.5-turbo",
  //   messages: msg,
  // })

  //app.log.info(completion.data.choices[0].message.content);

  const completion = await openai.createCompletion({
    model: "text-davinci-003",
    //prompt: question.substring( config.botName.length ),
    prompt:prompt,
    max_tokens: 1000
  });

  app.log.info(completion.data.choices[0].text);

  const issueComment = context.issue({
    body: completion.data.choices[0].text,
  });

  context.octokit.issues.createComment(issueComment);


}
