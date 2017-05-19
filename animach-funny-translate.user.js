// ==UserScript==
// @name         Funny translate
// @namespace    KabaNamespace
// @version      0.5
// @description  Переводит текст при отправке сообщения на китайский и обратно. Кнопка включения этого режима находится в одном ряду с другими кнопками под чатом.
// @author       Kaba
// @updateURL    https://github.com/kaba99/animach-funny-translate/raw/master/animach-funny-translate.user.js
// @downloadURL  https://github.com/kaba99/animach-funny-translate/raw/master/animach-funny-translate.user.js
// @supportURL   https://github.com/kaba99/animach-funny-translate/
// @include      http://tehtube.tv/*
// @include      https://tehtube.tv/*
// @include      http://tehtube.tv/r/*
// @include      https://tehtube.tv/r/*
// @include      http://*/r/animach
// @include      https://*/r/animach
// @match        https://cytu.be/r/anime_2chtv
// @match        http://cytu.be/r/anime_2chtv
// @match        http://tehtube.tv/
// @match        https://tehtube.tv/
// @match        http://tehtube.tv/r/animach
// @match        https://tehtube.tv/r/animach
// @grant        none
// ==/UserScript==

(function() {
    'use strict';
    
    function ControlBtn(options) {
        this.options = Object.assign({
            defaultStatus: 'off',
            statuses: [{title: 'Выкл', value: 'off', actions: []}]
        }, options);
        
        let replaceMessageSendStuff = function () {
            let that = this;
            
            $("#chatline").off('keydown').keydown(function(ev) {
                // Enter/return
                if(ev.keyCode == 13) {
                    if (CHATTHROTTLE) {
                        return;
                    }
                    var msg = $("#chatline").val();
                    if(msg.trim()) {
                        var meta = {};
                        if (USEROPTS.adminhat && CLIENT.rank >= 255) {
                            msg = "/a " + msg;
                        } else if (USEROPTS.modhat && CLIENT.rank >= Rank.Moderator) {
                            meta.modflair = CLIENT.rank;
                        }

                        // The /m command no longer exists, so emulate it clientside
                        if (CLIENT.rank >= 2 && msg.indexOf("/m ") === 0) {
                            meta.modflair = CLIENT.rank;
                            msg = msg.substring(3);
                        }

                        that.sendMessage(msg, meta);
                        CHATHIST.push($("#chatline").val());
                        CHATHISTIDX = CHATHIST.length;
                        $("#chatline").val("");
                    }
                    return;
                }
                else if(ev.keyCode == 9) { // Tab completion
                    try {
                        chatTabComplete();
                    } catch (error) {
                        console.error(error);
                    }
                    ev.preventDefault();
                    return false;
                }
                else if(ev.keyCode == 38) { // Up arrow (input history)
                    if(CHATHISTIDX == CHATHIST.length) {
                        CHATHIST.push($("#chatline").val());
                    }
                    if(CHATHISTIDX > 0) {
                        CHATHISTIDX--;
                        $("#chatline").val(CHATHIST[CHATHISTIDX]);
                    }

                    ev.preventDefault();
                    return false;
                }
                else if(ev.keyCode == 40) { // Down arrow (input history)
                    if(CHATHISTIDX < CHATHIST.length - 1) {
                        CHATHISTIDX++;
                        $("#chatline").val(CHATHIST[CHATHISTIDX]);
                    }

                    ev.preventDefault();
                    return false;
                }
            });


            $("#chatbtn").remove();
            if(USEROPTS.chatbtn) {
                var btn = $("<button/>").addClass("btn btn-default btn-block")
                .text("Отправить")
                .attr("id", "chatbtn")
                .appendTo($("#chatwrap"));
                btn.click(function() {
                    if($("#chatline").val().trim()) {
                        that.sendMessage($("#chatline").val(), {});
                        $("#chatline").val("");
                    }
                });
            }
        }.bind(this);
        
        
        this.findStatus = function(statusValue) {
            let statusObject = null;

            for (let n in this.options.statuses) {
                if (this.options.statuses[n].value == statusValue) {
                    statusObject = this.options.statuses[n];
                }
            }

            return statusObject;
        }.bind(this);
        
        
        this.translateText = function(text, sourceLang, targetLang) {
            if (text == '') {
                return Promise.resolve({text: text});
            }

            let promise = fetch('https://translate.googleapis.com/translate_a/single?client=gtx&sl=' + sourceLang + '&tl=' + targetLang + '&dt=t&q=' + text, {
                redirect: 'follow'
            });

            return promise.then(function (r) {
                return r.json();
            }).then(function(data) {
                if ((data[0] && data[0][0] && data[0][0][0])) {
                    return {text: data[0][0][0]};
                } else {
                    return {text: text, error: 'Ошибка обработки json.'};
                }
            }).catch(function (data) {
                return {text: text, error: (data + '')};
            });
        };
        
        
        this.sendMessage = function(msg, meta) {
            msg = msg.replace(/^\s+|\s+$/g, '');
            meta = meta || {};
            if (msg == '') {
                return;
            }
            
            let msgParts = msg.split(':');
            let morphedText = msgParts[msgParts.length - 1];
            let actions = this.findStatus(this.getStatus()).actions || [];
            
            let chain = Promise.resolve();
            for(let n = 0, actionsLen = actions.length; n < actionsLen; n++) {
                let sourceLang = (n == 0) ? 'auto' : actions[n - 1];
                let targetLang = actions[n];
                
                chain = chain.then(function () {
                    return this.translateText(morphedText, sourceLang, targetLang).then(function (translatedData) {
                        if (translatedData.error) {
                            alert(translatedData.error);
                        }
                        
                        morphedText = translatedData.text;
                    });
                }.bind(this));
            }
            
            chain.then(function () {
                msgParts[msgParts.length - 1] = morphedText;
                
                socket.emit("chatMsg", {
                    msg: msgParts.join(':'),
                    meta: meta
                });
            });
        }.bind(this);
        
        
        let initGUI = function () {
            let that = this;
            
            this.$wrapper = $('<div class="btn-group">').appendTo('#leftcontrols .btn-group');
            this.$btn = $('<button type="button" class="btn btn-sm btn-default glyphicon glyphicon-flag dropdown-toggle" data-toggle="dropdown">&nbsp;<span class="btn-title"></span>&nbsp;<span class="caret"></span></button>').appendTo(this.$wrapper);
            this.$btnTitle = this.$btn.find('.btn-title');
            this.$list = $('<ul class="dropdown-menu"></ul>').appendTo(this.$wrapper);
            this.$listItems = this.options.statuses.map(function (item) {
                return $('<li><a href="#" data-value="' + item.value + '">' + item.title + '</a></li>').appendTo(that.$list);
            });
            
            this.$list.on('click', 'a', function (e) {
                e.preventDefault();
                that.setStatus($(this).data('value'));
            });
            
            this.setStatus(this.getStatus());
        }.bind(this);
        
        
        this.init = function () {
            initGUI();
            replaceMessageSendStuff();
        };
        
        
        this.setStatus = function (status) {
            let statusObject = this.findStatus(status) || this.findStatus(this.options.defaultStatus);
            this._status = statusObject.value;
            this.$btnTitle.text(statusObject.title);
            
        }.bind(this);
        
        this.getStatus = function () {
            return this._status || this.options.defaultStatus;
        };
    }
    
    
    $(window).load(function() {
        window.controlBtnExtra = new ControlBtn({
            defaultStatus: 'off',
            statuses: [
                {title: 'Выкл', value: 'off', actions: []},
                {title: '->En', value: 'en', actions: ['en']},
                {title: '->Ua', value: 'ua', actions: ['uk']},
                {title: '->Chi->Ru', value: 'chi-ru', actions: ['zh-CN', 'ru']},
                {title: '->Chi', value: 'chi', actions: ['zh-CN']},
                {title: '->Ja', value: 'ja', actions: ['ja']},
                {title: '->Ja->Ru', value: 'ja-ru', actions: ['ja', 'ru']}
            ]
        });
        window.controlBtnExtra.init();
    });
})();