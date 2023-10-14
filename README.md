# Chatbot UI SDK

## To integrate in your projects:

- clone it or copy it in your projects directroy outside node_modules
- install it with `npm install /path/to/chatbotsdk` or add it manually to package.json dependencies like so `"chatbotsdk" : "file:/relative/path/to/chatbotsdk".` This will create a symlink from the project in your node_modules folder and install/use the same dependencies.

## How to use:

- `import the chatbot.css file in your js or scss or wherever you desire`
- `import chatbot from "chatbotsdk"`
- `chatbot.config.endpoint = "https://url.to.chatbot.service.com"`
- `chatbot.config.loginListener = (token) => { //tell me when the user is logged in through chatbot }`
- `chatbot.start()`
- when the user logs out of the website and you want the chatbot to forget the tokens and log out the user call `chatbot.userLoggedOutFromWebsite()`