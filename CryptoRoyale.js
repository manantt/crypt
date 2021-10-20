// ==UserScript==
// @name         CryptoRoyale
// @namespace    http://tampermonkey.net/
// @version      0.3
// @description  try to take over the world!
// @author       You
// @match        https://cryptoroyale.one/training/
// @icon         data:image/gif;base64,R0lGODlhAQABAAAAACH5BAEKAAEALAAAAAABAAEAAAICTAEAOw==
// @grant        none
// ==/UserScript==

const TYPE_POSITION = 0;
const TYPE_LOOTBOX = 1;
const TYPE_PLAYER = 2;

class Bot {
    constructor() {
        this.pause = true;
        this.wins = 0;
        this.loses = 0;
        this.start = new Date();
        this.initialRoy = null;

        this.playerId = null;
        this.lastBoost = new Date();
    }

    eachSecond() {
        if(!this.pause) {
            // cobrar cajas
            $(".cardList").first().click();
            // iniciar nueva partida
            if($("#right button").length) {
                if(game_state['cycle']['stage'] != 'post-game' && this.playerId) {
                    this.loses++;
                }
                // iniciar juego
                $("#right button").click();
            }
            // calcular roy/h
            if(this.initialRoy == null) {
                this.initialRoy = parseFloat($("#left b").html());
            } else {
                var royValue = parseFloat($("nav.navbar .container div > span:nth-child(3) a").html().replace("R:$", ""));
                var roy = parseFloat($("#left b").html());
                var t = (new Date() - this.start) / (1000 * 60 * 60);
                var royh = (roy - this.initialRoy) / t;
                var usdh = royh * royValue;
                $("#roy").html(roy);
                $("#royh").html(royh.toFixed(2));
            }
        }
    }

    gameloop() {
        switch(game_state['cycle']['stage']) {
            case 'pre-game':
                this.pregame();
                break;
            case 'post-game':
                this.postgame()
                break;
            default:
                if(!this.pause) {
                    try {
                        this.game();
                    } catch(e) {
                        //console.error(e);
                    }
                }
        }
    }

    pregame() {
        this.playerId = null;
    }

    postgame() {
        if(this.playerId) {
            if(game_state.winner == this.playerId) {
                this.wins++;
            } else {
                this.loses++;
            }
            this.playerId = null;
        }
    }

    game() {
        if(!this.playerId) {
            this.initGame();
        } else {
            this.moveTo(this.objetive);
            this.checkBoost(this.objetive);
        }
    }

    initGame() {
        moveTo(-1000, 0);
        for(var p in game_state.players) {
            if(game_state.players[p].to && game_state.players[p].to.x < -100) {
                this.playerId = p;
            }
        }
    }

    get objetive() {
        const COST_LOOTBOX_SAFEZONE = 2;
        const COST_LOOTBOX_GASZONE = 3;
        const COST_ENEMY_SAFEZONE = 1;
        const COST_ENEMY_GASZONE = 4;
        var minRisk = Number.MAX_SAFE_INTEGER;
        var objx = 0;
        var objy = 0;
        var type = TYPE_POSITION;
        // la caja más cercana
        for(var l in game_state.loot) {
            if(game_state.loot[l].t != "L" && this.isSafeToGo(game_state.loot[l].pos.x, game_state.loot[l].pos.y)) {
                let d = this.distanceTo(game_state.loot[l].pos.x, game_state.loot[l].pos.y);
                let risk = isInSafeZone(game_state.loot[l].pos.x, game_state.loot[l].pos.y) ? d*COST_LOOTBOX_SAFEZONE : d*COST_LOOTBOX_GASZONE;
                if(risk < minRisk) {
                    objx = game_state.loot[l].pos.x;
                    objy = game_state.loot[l].pos.y;
                    minRisk = risk;
                    type = TYPE_LOOTBOX;
                }
            }
        }
        // el enemigo vulnerable más cercano
        for(var e in game_state.players) {
            if(
                e != this.playerId && 
                this.isStronger(e) && 
                isAlive(e) && 
                this.isSafeToGo(game_state.players[e].pos.x, game_state.players[e].pos.y)
            ) {
                let d = this.distanceTo(game_state.players[e].pos.x, game_state.players[e].pos.y);
                let risk = isInSafeZone(game_state.players[e].pos.x, game_state.players[e].pos.y) ? d*COST_ENEMY_SAFEZONE : d*COST_ENEMY_GASZONE;
                if(risk < minRisk) {
                    objx = game_state.players[e].pos.x;
                    objy = game_state.players[e].pos.y;
                    minRisk = risk;
                    type = TYPE_PLAYER;
                }
            }
        }
        return {x: objx, y: objy, type: type};
    }

    moveTo(objetive) {
        moveTo(objetive.x, objetive.y);
    }

    checkBoost(objetive) {
        if(this.shouldBoost(objetive)) {
            this.lastBoost = new Date();
            this.boost();
        }
    }

    shouldBoost(objetive) {
        if(!game_state.players[this.playerId]) {
            return false;
        }
        const BOOST_CD = 500;
        const LOOTBOX_MIN_DISTANCE_TO_BOOST = 150;
        const MIN_INERTIA_TO_BOOST = 10;
        // NO USAR SI
        if(new Date() - this.lastBoost < BOOST_CD) { // está en cd
            return false;
        }
        if(objetive.type == TYPE_LOOTBOX && this.distanceTo(objetive.x, objetive.y) < LOOTBOX_MIN_DISTANCE_TO_BOOST) { // objetivo es caja y está cerca
            return false;
        }
        // USAR SI
        if( // si no hay suficiente aceleración
            !game_state.players[this.playerId].inertia || 
            Math.abs(game_state.players[this.playerId].inertia.x) + Math.abs(game_state.players[this.playerId].inertia.y) < MIN_INERTIA_TO_BOOST
        ) {
            return true;
        }
        // si la aceleración en alguna dirección no es correcta
        let movX = objetive.x - game_state.players[this.playerId].pos.x;
        let movY = objetive.y - game_state.players[this.playerId].pos.y;
        if(
            (movX > 0 && game_state.players[this.playerId].inertia.x > 0) ||
            (movX < 0 && game_state.players[this.playerId].inertia.x < 0) ||
            (movY > 0 && game_state.players[this.playerId].inertia.y > 0) ||
            (movY < 0 && game_state.players[this.playerId].inertia.y < 0)
        ) {
            return true;
        }
        return false;
    }

    boost() {
        user_state.local.keyboardboost = 1;
    }

    isStronger(enemyId) {
        return isStronger(this.playerId, enemyId)
    }

    distanceTo(x, y) {
        return distance(game_state.players[this.playerId].pos.x, game_state.players[this.playerId].pos.y, x, y);
    }

    isSafeToGo(x, y) {
        for(var e in game_state.players) {
            if (e != this.playerId) {
                if (!this.isStronger(e) && isAlive(e)) {
                    if(this.isInWay(x, y, e)) {
                        return false;
                    }
                }
            }
        }
        return true;
    }

    isInWay(x, y, e) {
        const MIN_RATIO = 1.2;
        let d1 = this.distanceTo(x, y);
        let d2 = this.distanceTo(game_state.players[e].pos.x, game_state.players[e].pos.y);
        let d3 = distance(game_state.players[e].pos.x, game_state.players[e].pos.y, x, y);
        return ((d2 + d3) / d1) < MIN_RATIO;
    }
}

function isStronger(player1Id, player2Id) {
    if(!game_state.players[player1Id] || !game_state.players[player2Id]) {
        return false;
    }
    var target = "R";
    if(game_state.players[player1Id].class == "R") {
        target = "S";
    } else if(game_state.players[player1Id].class == "S") {
        target = "P"
    }
    if(game_state.players[player2Id].class == target) {
        return true;
    }
    if(game_state.players[player2Id].class == game_state.players[player1Id].class && game_state.players[player2Id].HP < game_state.players[player1Id].HP * 0.75) {
        return true;
    }
    return false;
}

function isAlive(playerId) {
    return game_state.players[playerId].HP > 0;
}

function distance(x1, y1, x2, y2) {
    return Math.sqrt((x2-x1)*(x2-x1)+(y2-y1)*(y2-y1));
}

function isInSafeZone(x, y) {
    const GAS_AREA_RATIO = game.scale.gameSize._height / 6;
    var r = game_state.gas_area.r * GAS_AREA_RATIO;
    var d = distance(x, y, game_state.gas_area.x, game_state.gas_area.y);
    return(d < r);
}

function moveTo(x, y) {
        x = (x / game.scale.gameSize._width) * game.scale.displaySize._width;
        y = (y / game.scale.gameSize._height) * game.scale.displaySize._height;

        x = x + game.canvas.offsetLeft;
        y = y + game.canvas.offsetTop;

        const triggerClick = (target) => {
            let event = document.createEvent('MouseEvents');
            event.initEvent('mousemove', true, true);
            event.initMouseEvent('mousemove', true, false, window, 1, x, y, x, y, false, false, false, false, 0, null);
            target.dispatchEvent(event);
        };

        triggerClick(document.querySelector('canvas'));
    }

function initInterface(bot) {
    var html = "<span id='span' style='position: absolute; top: 0; left: 0; z-index:999'>pause</span>";

    html += "<span style='position: absolute; top: 50px; left: 0; z-index:999'><b>ROY</b></span>";
    html += "<span id='roy' style='position: absolute; top: 65px; left: 0; z-index:999'>0</span>";

    html += "<span style='position: absolute; top: 115px; left: 0; z-index:999'><b>ROY/h</b></span>";
    html += "<span id='royh' style='position: absolute; top: 130px; left: 0; z-index:999'>0</span>";
    $("body").prepend($(html));
    $(document).keypress(function(e) {
        bot.pause = !bot.pause;
        $("#span").html(bot.pause ? "pause" : "play");
    });
}

(function() {
    'use strict';

    var bot = new Bot();
    initInterface(bot);

    setTimeout(function() {
        socket.onAny(
            (event, data) => {
                bot.gameloop();
            }
        )
    }, 1000);

    setInterval(function() {
        bot.eachSecond();
    }, 1000);

})();
