import axios from "axios";
import storage from "./storage";

class Chatbot {

    config = {
        endpoint: null,
        loginListener: null,
    }

    _defaultForm = {
        action: "/",
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
        this.isOpen = true;
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

        this.messageContainer.addEventListener('click', (event) => {
            if (event.target.tagName === 'BUTTON') {
                this._sendButton(event.target.getAttribute('data-action'));
            }
        })

        if (this.isOpen) {
            this._toggleChat(true);
        }

        if (this.history.length > 0) {
            this.history.forEach(m => {
                this._appendMessage(m.message, m.isBot)
                this._appendHtml(m.html)
            });

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

    userLoggedOutFromWebsite() {
        axios.post(`${this.config.endpoint}/logged-out`, {sender: this.sender}).then(() => {
            this._forgetToken();
        }).catch(console.log);
    }

    _userLoggedIn(token, refresh_token, expires_in) {
        this.config.loginListener(token, refresh_token, expires_in);
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
        this._callAPI(formData);
    }

    _sendButton(action) {
        if (this.processing) {
            return;
        }
        this._toggleSubmission();
        const formData = new FormData();
        formData.append('sender', this.sender);
        formData.append('message', action);
        if (this.accessToken) {
            formData.append('access_token', this.accessToken);
        }
        this._callAPI(formData);

    }

    _uuid() {
        return ([1e7] + -1e3 + -4e3 + -8e3 + -1e11).replace(/[018]/g, c =>
            (c ^ crypto.getRandomValues(new Uint8Array(1))[0] & 15 >> c / 4).toString(16)
        );
    }

    _appendMessage(message, isBot = true, button = null) {
        if (!message) {
            return;
        }
        const replyClass = isBot ? '' : 'cb-user';
        if (button) {
            message += `<br/> <button data-action="${button.action}">${button.text}</button>`;
        }
        this.messageContainer.innerHTML +=
            `<div class="cb-reply-container ${replyClass}"><div class="cb-reply ${replyClass}">${message}</div></div>`
    }

    _appendHtml(html) {
        if (!html)
            return;
        this.messageContainer.innerHTML += `<div class="cb-reply-container"><div class="cb-reply">${html}</div></div>`;
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

    _callAPI(formData) {
        axios.post(this.form.getAttribute('action'), formData).then((response) => {
            const firstInput = this.form.querySelector('input')
            this._appendMessage(firstInput.value, false);
            this._appendMessage(response.data.custom.message, true, response.data.custom.button);

            this._updateForm(response.data.custom.form ?? this._defaultForm);

            if (response.data.custom?.access_token) {
                this._saveToken(response.data.custom.access_token, response.data.custom.refresh_token);
                this._userLoggedIn(response.data.custom.access_token, response.data.custom.refresh_token, response.data.custom.expires_in);
            }

            this.history.push({message: firstInput.value, isBot: false});
            this.history.push({message: response.data.custom.message, isBot: true});

            if (response.data.custom?.html) {
                this._appendHtml(response.data.custom.html);
                this.history.push({message: null, html: response.data.custom.html, isBot: true})
            }

            if (response.data.custom?.redirect) {
                window.location.href = response.data.custom.redirect;
            }

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

    _saveToken(token, refresh_token) {
        storage.set('cb-access-token', token);
        storage.set('cb-refresh-token', refresh_token);
        this.accessToken = token;
    }

    _forgetToken() {
        storage.forget('cb-access-token');
        storage.forget('cb-refresh-token');
        this.accessToken = null;
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
                            <div class="cb-title">
                                <div>پشتیبان دارتیل</div>
                                <div class="cb-subtitle">پاسخگویی شنبه تا چهارشنبه ساعت ۱۲ تا ۱۷</div>
                            </div>
                            <div class="cb-close-container">
                                <button id="cb-close-button" class="cb-close-button">
                                    <svg width="52" height="52" viewBox="0 0 52 52" fill="none" xmlns="http://www.w3.org/2000/svg">
                                        <g filter="url(#filter0_ddd_34_34717)">
                                            <circle cx="26" cy="26" r="26" fill="white"/>
                                        </g>
                                        <path transform="translate(-24 -20)" d="M52.41 46L58.71 39.71C58.8983 39.5217 59.0041 39.2663 59.0041 39C59.0041 38.7337 58.8983 38.4783 58.71 38.29C58.5217 38.1017 58.2663 37.9959 58 37.9959C57.7337 37.9959 57.4783 38.1017 57.29 38.29L51 44.59L44.71 38.29C44.5217 38.1017 44.2663 37.9959 44 37.9959C43.7337 37.9959 43.4783 38.1017 43.29 38.29C43.1017 38.4783 42.9959 38.7337 42.9959 39C42.9959 39.2663 43.1017 39.5217 43.29 39.71L49.59 46L43.29 52.29C43.1963 52.383 43.1219 52.4936 43.0711 52.6154C43.0203 52.7373 42.9942 52.868 42.9942 53C42.9942 53.132 43.0203 53.2627 43.0711 53.3846C43.1219 53.5064 43.1963 53.617 43.29 53.71C43.383 53.8037 43.4936 53.8781 43.6154 53.9289C43.7373 53.9797 43.868 54.0058 44 54.0058C44.132 54.0058 44.2627 53.9797 44.3846 53.9289C44.5064 53.8781 44.617 53.8037 44.71 53.71L51 47.41L57.29 53.71C57.383 53.8037 57.4936 53.8781 57.6154 53.9289C57.7373 53.9797 57.868 54.0058 58 54.0058C58.132 54.0058 58.2627 53.9797 58.3846 53.9289C58.5064 53.8781 58.617 53.8037 58.71 53.71C58.8037 53.617 58.8781 53.5064 58.9289 53.3846C58.9797 53.2627 59.0058 53.132 59.0058 53C59.0058 52.868 58.9797 52.7373 58.9289 52.6154C58.8781 52.4936 58.8037 52.383 58.71 52.29L52.41 46Z" fill="#676E73"/>
                                    </svg>
                                </button>
                            </div>
                        </div>
                        <div class="cb-message-container" id="cb-message-container">
                            
                        </div>
                        <div style="width: 85%; margin: 0 auto 10px;">
                            <hr style="border-top: 2px solid #E1E3E5; border-radius: 10%"/>
                        </div>
                        <form class="cb-forms-container" name="cb-form">
                            <div id="form-inputs">
                                <input autocomplete="off" name="message" class="cb-input" placeholder="چه سوالی دارید؟">
                            </div>
                            <div class="cb-buttons-container">
                                <button class="cb-submit">
                                    <svg width="50" height="50" viewBox="0 0 50 50" fill="none" xmlns="http://www.w3.org/2000/svg">
                                        <g filter="url(#filter0_ddd_34_35237)">
                                        <circle cx="25" cy="25" r="25" fill="url(#paint0_linear_34_35237)"/>
                                        </g>
                                        <g filter="url(#filter1_dd_34_35237)" transform="translate(-18, -18)">
                                            <path fill-rule="evenodd" clip-rule="evenodd" d="M41.6112 51.3333C41.6287 51.3333 41.6453 51.3325 41.662 51.3316C42.0387 51.3091 42.3528 51.0358 42.4278 50.6658L43.7095 44.36C43.7762 44.0316 44.032 43.7758 44.3603 43.7091L50.6662 42.4266C51.0362 42.3525 51.3095 42.0383 51.332 41.6616C51.3545 41.2841 51.122 40.9391 50.7637 40.8208L37.4303 36.3766C37.1312 36.275 36.8012 36.3533 36.5778 36.5775C36.3545 36.8008 36.277 37.1308 36.3762 37.43L40.8212 50.7633C40.9345 51.1058 41.2545 51.3333 41.6112 51.3333Z" fill="#2B2F33"/>
                                            <mask id="mask0_34_35237" style="mask-type:luminance" maskUnits="userSpaceOnUse" x="36" y="36" width="16" height="16">
                                            <path fill-rule="evenodd" clip-rule="evenodd" d="M41.6112 51.3333C41.6287 51.3333 41.6453 51.3325 41.662 51.3316C42.0387 51.3091 42.3528 51.0358 42.4278 50.6658L43.7095 44.36C43.7762 44.0316 44.032 43.7758 44.3603 43.7091L50.6662 42.4266C51.0362 42.3525 51.3095 42.0383 51.332 41.6616C51.3545 41.2841 51.122 40.9391 50.7637 40.8208L37.4303 36.3766C37.1312 36.275 36.8012 36.3533 36.5778 36.5775C36.3545 36.8008 36.277 37.1308 36.3762 37.43L40.8212 50.7633C40.9345 51.1058 41.2545 51.3333 41.6112 51.3333Z" fill="white"/>
                                            </mask>
                                        <g mask="url(#mask0_34_35237)">
                                        <rect width="20" height="20" transform="matrix(-1 0 0 1 53.0004 33)" fill="white"/>
                                        </g>
                                        </g>
                                        <defs>
                                        <filter id="filter1_dd_34_35237" x="31.0004" y="32" width="24" height="24" filterUnits="userSpaceOnUse" color-interpolation-filters="sRGB">
                                        <feFlood flood-opacity="0" result="BackgroundImageFix"/>
                                        <feColorMatrix in="SourceAlpha" type="matrix" values="0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 127 0" result="hardAlpha"/>
                                        <feOffset dy="1"/>
                                        <feGaussianBlur stdDeviation="0.5"/>
                                        <feColorMatrix type="matrix" values="0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0.03 0"/>
                                        <feBlend mode="normal" in2="BackgroundImageFix" result="effect1_dropShadow_34_35237"/>
                                        <feColorMatrix in="SourceAlpha" type="matrix" values="0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 127 0" result="hardAlpha"/>
                                        <feOffset dy="1"/>
                                        <feGaussianBlur stdDeviation="1"/>
                                        <feColorMatrix type="matrix" values="0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0.03 0"/>
                                        <feBlend mode="normal" in2="effect1_dropShadow_34_35237" result="effect2_dropShadow_34_35237"/>
                                        <feBlend mode="normal" in="SourceGraphic" in2="effect2_dropShadow_34_35237" result="shape"/>
                                        </filter>
                                        <linearGradient id="paint0_linear_34_35237" x1="0" y1="0" x2="40.3706" y2="0.377593" gradientUnits="userSpaceOnUse">
                                        <stop stop-color="#B886EB"/>
                                        <stop offset="1" stop-color="#8137A4"/>
                                        </linearGradient>
                                        </defs>
                                    </svg>
                                </button>
                            </div>
                        </form>
                    </div>
                </div>`
    }
}

export default new Chatbot();
