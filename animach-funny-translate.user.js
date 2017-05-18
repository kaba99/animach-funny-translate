// ==UserScript==
// @name         Funny translate
// @namespace    KabaNamespace
// @version      0.4
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
    
    let isScriptActive = false;
    
    function replaceMessageSendStuff() {
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

                    sendMessage(msg, meta);
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
                    sendMessage($("#chatline").val(), {});
                    $("#chatline").val("");
                }
            });
        }
    }
    
    function translateText(text, sourceLang, targetLang) {
        if (text == '') {
            return Promise.resolve('');
        }
        
        let promise = fetch('https://translate.googleapis.com/translate_a/single?client=gtx&sl=' + sourceLang + '&tl=' + targetLang + '&dt=t&q=' + text, {});
        
        return promise.then(function (r) {
            return r.json();
        }).then(function(data) {
            if (sourceLang == 'auto') {
                return (data[0] && data[0][0] && data[0][0][0] && data[0][0][0][0]) ? data[0][0][0][0] : '';
            } else {
                return (data[0] && data[0][0] && data[0][0][0]) ? data[0][0][0] : '';
            }
        }).catch(function () {
            alert('Невозможно перевести текст');
            return text;
        });
    }
    
    function initControlBtn() {
        $('<button class="btn btn-sm btn-default glyphicon glyphicon-sort"></button>')
        .appendTo('#leftcontrols .btn-group')
        .click(function () {
            if (isScriptActive) {
                $(this).removeClass('btn-success').addClass('btn-default');
            } else {
                $(this).removeClass('btn-default').addClass('btn-success');
            }
            isScriptActive = !isScriptActive;
        });
    }
    
    function sendMessage(msg, meta) {
        let msgParts = msg.split(':');
        if (msgParts.length == 0) {
            return;
        }
        
        if (isScriptActive) {            
            translateText(msgParts[msgParts.length - 1], 'auto', 'zh-CN').then(function(translatedText) {
                return (translatedText == msgParts[msgParts.length - 1]) ? translatedText : translateText(translatedText, 'ja', 'ru');
            }).then(function(morphedText) {
                msgParts[msgParts.length - 1] = morphedText;
                
                socket.emit("chatMsg", {
                    msg: msgParts.join(':'),
                    meta: meta
                });
            });
        } else {
            socket.emit("chatMsg", {
                msg: msgParts.join(':'),
                meta: meta
            });
        }
    }
    
    
    $(window).load(function() {
        replaceMessageSendStuff();
        initControlBtn();
    });
})();