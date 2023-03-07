# chatrepo
Chat with your github repo with ChatGPT in Github Actions

## 概述

ChatRepo测试版，使用git app+Vercel无服务计算平台构建。

有点复杂，Bot这个东西本身就和普通ci有所不同，本bot又涉及到数据隐私，因此只能用较为复杂的方法实现。

### 1）平台整体运行逻辑

1. 配置好git app
2. 用户提交issue
3. 仓库触发app运行
4. app向指定的webhook点，发用户的isseu相关参数
5. vercel serverless平台启动服务，开始计算
6. 最后把生成的答案写回issue

![截屏2023-03-07 20.17.31](https://raw.githubusercontent.com/muchengl/pic_storage/main/uPic/%E6%88%AA%E5%B1%8F2023-03-07%2020.17.31.png)

### 2）开发者测逻辑

![截屏2023-03-07 20.17.11](https://raw.githubusercontent.com/muchengl/pic_storage/main/uPic/%E6%88%AA%E5%B1%8F2023-03-07%2020.17.11.png)

对于开发者，为了搭建ChatRepo平台，需要完成以下几步：

1. 申请一个Git App，git app只有公开和私有两种选项。由于chatrepo含有chatGPT token，因此不能公开，只能私有申请一个（此处webhook随便填一个）。
    https://github.com/settings/apps/new

2. 创建ChatRepo仓库，里面放ChatRepo代码（这个我们已经有了）

3. 在vercel平台，从github导入ChatRepo仓库，后续该平台会自动构建
    https://vercel.com/new

4. 此时，ChatRepo没有任何隐私数据（Git App的密钥和chatGPT token），因此需要在vercel平台的环境变量里加入：

    ![截屏2023-03-07 20.24.53](https://raw.githubusercontent.com/muchengl/pic_storage/main/uPic/%E6%88%AA%E5%B1%8F2023-03-07%2020.24.53.png)

    ![截屏2023-03-07 20.25.13](https://raw.githubusercontent.com/muchengl/pic_storage/main/uPic/%E6%88%AA%E5%B1%8F2023-03-07%2020.25.13.png)
5. 重启vercel平台上的服务，载入环境变量
6. 在Git App配置页面修改App的权限：
        https://github.com/settings/apps/【your app name】/permissions

        ```
        把这几项设置为可读写：
        Commit statuses
        Contents
        Discussions
        Issues
        ```

        在事件处，勾选以下事件：

        ![截屏2023-03-07 20.28.55](https://raw.githubusercontent.com/muchengl/pic_storage/main/uPic/%E6%88%AA%E5%B1%8F2023-03-07%2020.28.55.png)

7. 此时Vercel平台会分配一个Domin，将app的webhook设置为：
        domin+/api/github/webhooks

        ![截屏2023-03-07 20.36.20](https://raw.githubusercontent.com/muchengl/pic_storage/main/uPic/%E6%88%AA%E5%B1%8F2023-03-07%2020.36.20.png)应该是类似这样的一个链接：https://chatbot-rosy.vercel.app/api/github/webhooks
8. 安装Git App，选择需要ChatRepo的仓库
        https://github.com/settings/apps/【your app name】/installations
9. 在仓库新建一个issue，进行测试。如果一切无误，则可以看到CharRepo上线自动回答
        ```
        格式：
        /Bot xxxxx
        和chat gpa普通聊天
        /chatrepo xxxxx
        询问charrepo仓库相关问题
        ```

## 3) 开发者模式

    开发过程中，不需要每次都进行部署，可以搭建一个本地开发环境：

    参考：https://probot.github.io/docs/development/#running-the-app-locally

    1.环境初始化

    ```
    npm install
    npm start
    ```

    2.根据提示，访问localhost:3000

    3.根据指示创建一个新的Git App

    4.此时，prebot会创建一个.env文件，在文件中添加：

    ```
    GPT_KEY= [your chatGPT token]
    ```

    5.参考第二章，设置app权限，并选择一个repo安装该app





