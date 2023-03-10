/**
 * @param {import('probot').Probot} app
 */

const { Configuration, OpenAIApi } = require("openai");
// const request = require('request');
var request = require('sync-request');
var config=require('./src/config.js');


module.exports = (app) => {
  console.log("Wow! The app was loaded!");

  config.chatGPTKey=process.env.GPT_KEY;

  app.on("issues.opened", async (context) => {
    return context.octokit.issues.createComment(
        context.issue({ body: "Hello, I am CharRepo🤖️. What can I do for you?\n If you want me to answer questions about this repo, please use：/chatrepo [you question]." })
    );
  });


  app.on("issue_comment.created", async (context) => {
    if (context.isBot) return;


    if(context.payload.comment.body.startsWith("/Bot")){

      const configuration = new Configuration({
        apiKey: config.chatGPTKey,
      });
      const openai = new OpenAIApi(configuration);

      var info=context.payload.comment.body.substring(4);
      console.log("Msg:"+info);

      const completion = await openai.createCompletion({
        model: "text-davinci-003",
        prompt: info,
        max_tokens: 200,
        temperature: 0,
        top_p: 1,
        echo: true,
        stream: false,
        logprobs: null
      });

      console.log(completion.data.choices[0].text);

      const issueComment = context.issue({
        body: completion.data.choices[0].text,
      });

      // const completion = await openai.createChatCompletion({
      //   model: "gpt-3.5-turbo",
      //   messages: [
      //     {"role": "user", "content": info}
      //   ],
      // });
      //
      // app.log.info(completion.data.choices[0].message.content);
      //
      // const issueComment = context.issue({
      //   body: completion.data.choices[0].message.content,
      // });


      return context.octokit.issues.createComment(issueComment);
    }

    if(context.payload.comment.body.startsWith(config.botName)){

      console.log(context.payload.comment.body);
      await readmeAndKeyword(context,app);

      //getKeyWords(context,app,readme);

    }

  })


};

async function readmeAndKeyword(context,app){

  var repo_name=context.payload.repository.name;
  var full_name=context.payload.repository.full_name;

  // 获取readme 文件
  // https://api.github.com/repos/【owner】/【repo name】/readme
  var url="https://api.github.com/repos/"+full_name+"/readme";
  var readme=""

  console.log("Get Readme......");
  console.log(url);

  var readme_slice=[];

  var res_raw = request('GET', url, {
    headers: {
      'User-Agent': 'request',
    },
  });
  console.log("Get Readme succeed");

  var res = JSON.parse(res_raw.getBody('utf8'));
  const buff = Buffer.from(JSON.stringify(res.content), 'base64');
  readme=buff.toString('utf-8');

  for (let i = 0; i <readme.length ; i+=1000) {
    readme_slice.push(readme.slice(i,i+1000))
  }

  //return readme_slice

  await getKeyWords(context,app,readme_slice);

  // let p = new Promise((resolve, reject) => {
  //   request(url, { json: true , headers:{'User-Agent': 'request'} }, (err, res, body) => {
  //     if (err) {
  //       console.log("error");
  //       reject()
  //       return console.log(err);
  //     }
  //
  //     console.log("Get Readme succeed");
  //
  //     const buff = Buffer.from(JSON.stringify(body.content), 'base64');
  //     readme=buff.toString('utf-8');
  //
  //
  //     //var reg = "/(\d{1000})/";
  //     //var readme_slice = readme.split(reg);
  //     //app.log(readme_slice[0]);
  //     // var readme_slice=readme.substring();
  //     for (let i = 0; i <readme.length ; i+=1000) {
  //       readme_slice.push(readme.slice(i,i+1000))
  //     }
  //
  //     resolve();
  //
  //   });
  //
  // })
  //
  // p.then(() => {
  //   getKeyWords(context,app,readme_slice);
  // }, () => {
  //   console.log("Readme get fail!")
  // })



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

  // for(var i=0;i<readme.length;i++){
  //   msg.push(
  //       {"role": "assistant", "content": readme[i]}
  //   );
  // }

  msg.push(
      {"role": "assistant", "content": readme[0]}
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

  console.log("Get key Words......")
  //app.log.info(msg);
  const completion = await openai.createChatCompletion({
    model: "gpt-3.5-turbo",
    messages: msg,
  })
  console.log("Request GPT sueecsed: ");
  console.log(completion);

  await search(context,
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

async function search(context,app,keyword_raw,full_name,msg){
  console.log("keywords:"+keyword_raw);

  // 修正keyword的格式
  var keywords=keyword_raw;

  //搜索repo
  var url="https://api.github.com/search/code?q="+keywords+"+in:file+repo:"+full_name;
  console.log(url);


  var res_raw = request('GET', url, {
    headers: {
      'User-Agent': 'request',
      'Accept': 'application/vnd.github.text-match+json'
    },
  });
  console.log("Github Research succeed");

  var body = JSON.parse(res_raw.getBody('utf8'));

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

  console.log(prompt);
  await getOutput(context,app,prompt,msg);


  // request(url, { json: true , headers:{'User-Agent': 'request','Accept': 'application/vnd.github.text-match+json'} }, (err, res, body) => {
  //   //app.log.info(body)
  //
  //
  //   var prompt="";
  //   prompt+="Github search results\n";
  //   prompt+="Found "+body.items.length+" results\n\n";
  //
  //   for(var i=0;i<body.items.length;i++){
  //     var item=body.items[i];
  //     // f"[{j + 1}] Name: {item['name']}" + f" Path: {item['path']}" + f" URL: {item['html_url']}"
  //     // f"[{j + 1}] Title: {item['title']}" + f" URL: {item['html_url']}"
  //
  //     if(item.hasOwnProperty("name")){
  //       prompt+="["+i+1+"] Name:"+item.name+" Path:"+item.path+" URL:"+item.html_url+"\n";
  //     }
  //     else{
  //       prompt+="["+i+1+"] Title:"+item.title+" URL:"+item.html_url+"\n";
  //     }
  //
  //
  //   }
  //
  //   prompt+="\n";
  //   prompt+="Instructions: Using the provided Github Code search results, write a comprehensive reply to the given query. Make sure to cite results using [[number](URL)] notation after the reference. If the provided search results refer to multiple subjects with the same name, write separate answers for each subject.\n"
  //
  //   console.log(prompt);
  //   getOutput(context,app,prompt,msg);
  // });


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

  console.log(completion.data.choices[0].text);

  const issueComment = context.issue({
    body: completion.data.choices[0].text,
  });

  context.octokit.issues.createComment(issueComment);


}
