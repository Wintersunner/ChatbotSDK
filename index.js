import axios from "axios";
import storage from "./storage";

class Chatbot {

    config = {
        endpoint: null,
        loginListener: null,
    }

    _defaultForm = {
        action: this.config.endpoint,
        fields: [
            {name: "message", type: "text", placeholder: "متن سوال یا پیام"}
        ]
    }

    start() {
        document.body.innerHTML += this.template();

        this.sender = storage.setIfNull('cb-sender', this._uuid());
        this.history = storage.setIfNull('cb-history', []);
        // this.isOpen = storage.setIfNull('cb-is-open', false);
        this.isOpen = false;
        this.accessToken = storage.get('cb-access-token');
        this.processing = false;

        this.button = document.querySelector('#cb-chat-trigger-button');
        this.button.addEventListener('click', () => {
            this._toggleChat();
        });

        this.closeButton = document.querySelector('#cb-close-button');
        this.closeButton.addEventListener('click', () => {
            this._toggleChat();
        });

        this.messageContainer = document.querySelector('#cb-message-container');

        if (this.isOpen) {
            this._toggleChat(true);
        }

        if (this.history.length > 0) {
            this.history.forEach(m => this._appendMessage(m.message, m.isBot));
            this._scrollToTheEnd();
        } else {
            this._appendMessage("سلام، چطور می‌تونم کمکتون کنم؟");
        }

        this.form = document.querySelector('form[name="cb-form"]');
        this.form.setAttribute('action', this.config.endpoint);
        this.form.addEventListener('submit', (e) => {
            e.preventDefault();
            this._send();
        });
    }

    userLoggedInWebsite(token, refresh_token) {
        this._saveToken(token, refresh_token);
        axios.post(`${this.config.endpoint}/logged-in`, {sender: this.sender}).then(() => {

        }).catch(() => {
            // console.log("Could not save user status");
        });
    }

    _userLoggedIn(token, refresh_token) {
        this.config.loginListener(token, refresh_token);
    }

    _toggleChat(isInitial = false) {
        this.button.classList.toggle('cb-hidden');
        document.querySelector('#cb-chat-container').classList.toggle('cb-hidden');
        // if (!isInitial)
        //     storage.set('cb-is-open', !this.isOpen);
        this._scrollToTheEnd();
    }

    _scrollToTheEnd() {
        this.messageContainer.scrollTop = this.messageContainer.scrollHeight;
    }

    _send() {
        if (this.processing || this._hasEmptyField()) {
            return;
        }

        this._toggleSubmission();
        const formData = new FormData(this.form)
        formData.append('sender', this.sender);
        if (this.accessToken) {
            formData.append('access_token', this.accessToken);
        }
        axios.post(this.form.getAttribute('action'), formData).then((response) => {
            const firstInput = this.form.querySelector('input')
            this._appendMessage(firstInput.value, false);
            this._appendMessage(response.data.custom.message);
            this._updateForm(response.data.custom.form ?? this._defaultForm);

            if (response.data.custom?.access_token) {
                this._saveToken(response.data.custom.access_token, response.data.custom.refresh_token);
                this._userLoggedIn(response.data.custom.access_token, response.data.custom.refresh_token);
            }

            this.history.push({message: firstInput.value, isBot: false});
            this.history.push({message: response.data.custom.message, isBot: true});

            storage.set('cb-history', this.history);

        }).catch((e) => {
            console.log(e);
            this._appendMessage(e.response.data.message ?? "خطای ناشناخته");
        }).then(() => {
            this._toggleSubmission();
            this._scrollToTheEnd();
            this.form.querySelector('input').focus();
        });
    }

    _uuid() {
        return ([1e7] + -1e3 + -4e3 + -8e3 + -1e11).replace(/[018]/g, c =>
            (c ^ crypto.getRandomValues(new Uint8Array(1))[0] & 15 >> c / 4).toString(16)
        );
    }

    _appendMessage(message, isBot = true) {
        const replyClass = isBot ? '' : 'cb-user';
        this.messageContainer.innerHTML +=
            `<div class="cb-reply-container ${replyClass}"><div class="cb-reply ${replyClass}">${message}</div></div>`
    }

    _toggleSubmission() {
        this.processing = !this.processing;
        this.form.toggleAttribute('disabled');
    }

    _updateForm(form) {
        const action = this.config.endpoint + form.action;
        const fields = form.fields;
        this.form.setAttribute('action', action);
        // let html = '';
        this.form.querySelector('#form-inputs').innerHTML = null;
        fields.forEach((field) => {
            const input = document.createElement('input');
            input.setAttribute('type', field.type);
            input.setAttribute('placeholder', field.placeholder);
            input.setAttribute('name', field.name);
            if (field.value) {
                input.value = field.value;
            }
            this.form.querySelector('#form-inputs').appendChild(input);
            // html += `<input autocomplete="off" class="cb-input" type="${field.type}" placeholder="${field.placeholder}" name="${field.name}">`
        });
        // this.form.querySelector('#form-inputs').innerHTML = html;
    }

    _saveToken(token, refresh_token) {
        storage.set('cb-access-token', token);
        storage.set('cb-refresh-token', refresh_token);
        this.accessToken = token;
    }

    _hasEmptyField() {
        return [...document.querySelector('#form-inputs').querySelectorAll('input')].some(i => i.value === "");
    }

    template() {
        return `<div class="cb-container">
                    <button class="cb-trigger-button" id="cb-chat-trigger-button">
                        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 256 256" width="48">
                            <path d="M128,232a103.6,103.6,0,0,1-50-12.8l-30,8.5A15.9,15.9,0,0,1,28.3,208l8.5-30A104,104,0,1,1,128,232ZM79,202.6a8.7,8.7,0,0,1,4.1,1.1,88,88,0,1,0-30.8-30.8,8.2,8.2,0,0,1,.8,6.3l-9.5,33.2,33.2-9.5A8.3,8.3,0,0,1,79,202.6Z"/>
                        </svg>
                    </button>
                    <div class="cb-chat-container cb-hidden" id="cb-chat-container">
                        <div class="cb-title-container">
                            <div class="cb-title">چت بات دارتیل</div>
                            <div class="cb-close-container">
                                <button id="cb-close-button" class="cb-close-button">
                                    <svg fill="white" xmlns="http://www.w3.org/2000/svg" width="18" height="18"
                                     viewBox="0 0 24 24"><path d="M23 20.168l-8.185-8.187 8.185-8.174-2.832-2.807-8.182 8.179-8.176-8.179-2.81 2.81 8.186 8.196-8.186 8.184 2.81 2.81 8.203-8.192 8.18 8.192z"/></svg>
                                </button>
                            </div>
                        </div>
                        <div class="cb-message-container" id="cb-message-container">
                            
                        </div>
                        <form class="cb-forms-container" name="cb-form">
                            <div id="form-inputs">
                                <input autocomplete="off" name="message" class="cb-input" placeholder="متن پیغام یا سوال خود را بنویسید...">
                            </div>
                            <div class="cb-buttons-container">
                                <button class="cb-submit">ارسال</button>
                            </div>
                        </form>
                    </div>
                </div>`
    }
}

export default new Chatbot();
