// ==UserScript==
// @name         CryptoRoyale
// @namespace    http://tampermonkey.net/
// @version      0.2
// @description  try to take over the world!
// @author       You
// @match        https://cryptoroyale.one/training/
// @icon         data:image/gif;base64,R0lGODlhAQABAAAAACH5BAEKAAEALAAAAAABAAEAAAICTAEAOw==
// @grant        none
// ==/UserScript==
var pause = true;
var player = null;
var wins = 0;
var loses = 0;
var start = new Date();
var initialRoy = null;

(function() {
    'use strict';
    setTimeout(function() {
        socket.onAny(
            (event, data) => {
                if(!pause) {
                    gameloop();
                }
            }
        )
    }, 1000);

    setInterval(function() {
        if(!pause) {
            // cobrar cajas
            $(".cardList").first().click();
            if($("#right button").length) {
                if(game_state['cycle']['stage'] != 'post-game' && player) {
                    loses++;
                    printStats();
                }
                // iniciar juego
                $("#right button").click();
            }
            // calcular roy/h
            if(initialRoy == null) {
                initialRoy = parseFloat($("#left b").html());
            } else {
                var royValue = parseFloat($("nav.navbar .container div > span:nth-child(3) a").html().replace("R:$", ""));
                var roy = parseFloat($("#left b").html());
                var t = (new Date() - start) / (1000 * 60 * 60);
                var royh = (roy - initialRoy) / t;
                var usdh = royh * royValue;
                $("#roy").html(roy);
                $("#royh").html(royh.toFixed(2));
            }

        }
    }, 1000);

    initInterface();
})();

function gameloop() {
    checkstate();
}

function checkstate() {
    switch(game_state['cycle']['stage']) {
        case 'pre-game':
            player = null;
            break;
        case 'post-game':
            if(player) {
                if(game_state.winner == player) {
                    wins++;
                } else {
                    loses++;
                }
                player = null;
                printStats();
            } else {

            }
            break;
        default:
            try {
                play();
            } catch(e) {
                console.error(e);
            }

    }
}

function play() {
    // TODO: atacar enemigo lasthiteable
    // TODO: si solo quedan enemigos golpeables ir a por ellos

    if(!player) {
        moveTo(-1000, 0);
        for(p in game_state.players) {
            if(game_state.players[p].to.x < -100) {
                player = p;
            }
        }
    } else if(typeof game_state.players[player].pos != "undefined") {
        var mindist = 99999;
        var objx = 0;
        var objy = 0;
        var loot = false;
        var d;
        // la caja más cercana
        for(var l in game_state.loot) {
            if(game_state.loot[l].t != "L" && isSafeToGo(game_state.loot[l].pos.x, game_state.loot[l].pos.y)) {
                d = playerDistanceTo(game_state.loot[l].pos.x, game_state.loot[l].pos.y);
                //
                d = isInSafeZone(game_state.loot[l].pos.x, game_state.loot[l].pos.y) ? d*2 : d*3;
                if(d < mindist) {
                    objx = game_state.loot[l].pos.x;
                    objy = game_state.loot[l].pos.y;
                    mindist = d;
                    loot = true;
                }
            }
        }
        // el enemigo vulnerable más cercano
        for(var e in game_state.players) {
            if(e != player && isWeaker(game_state.players[e]) && game_state.players[e].HP > 0 && isSafeToGo(game_state.players[e].pos.x, game_state.players[e].pos.y)) {
                d = playerDistanceTo(game_state.players[e].pos.x, game_state.players[e].pos.y);
                d = isInSafeZone(game_state.players[e].pos.x, game_state.players[e].pos.y) ? d : d*4;
                if(d < mindist) {
                    objx = game_state.players[e].pos.x;
                    objy = game_state.players[e].pos.y;
                    mindist = d;
                    loot = false;
                }
            }
        }
        // move
        //console.error(isSafeToGo(objx, objy));
        moveTo(objx, objy);
        if(checkBoost(objx, objy, loot)) {
            lastBoost = new Date();
            user_state.local.keyboardboost = 1;
        }
    }
}
var lastBoost = new Date();
const BOOST_CD = 500;
function checkBoost(x, y, loot) {
    // NO USAR SI
    // está en cd
    if(new Date() - lastBoost < BOOST_CD){
        return false;
    }
    // objetivo es caja y está cerca
    if(loot && playerDistanceTo(x, y) < 150) {
        return false;
    }

    // USAR SI
    // si no hay suficiente aceleración
    if(!game_state.players[player].inertia || Math.abs(game_state.players[player].inertia.x)+Math.abs(game_state.players[player].inertia.y) < 10) {
        return true;
    }

    // si la aceleración no es en la dirección correcta
    var movX = x - game_state.players[player].pos.x;
    var movY = y - game_state.players[player].pos.y;
    if(movX > 0 && game_state.players[player].inertia.x > 0) {
        return true;
    }
    if(movX < 0 && game_state.players[player].inertia.x < 0) {
        return true;
    }
    if(movY > 0 && game_state.players[player].inertia.y > 0) {
        return true;
    }
    if(movY < 0 && game_state.players[player].inertia.y < 0) {
        return true;
    }
    return false;
}

function initInterface() {
    var html = "<span id='span' style='position: absolute; top: 0; left: 0; z-index:999'>pause</span>";

    html += "<span style='position: absolute; top: 50px; left: 0; z-index:999'><b>ROY</b></span>";
    html += "<span id='roy' style='position: absolute; top: 65px; left: 0; z-index:999'>0</span>";

    html += "<span style='position: absolute; top: 115px; left: 0; z-index:999'><b>ROY/h</b></span>";
    html += "<span id='royh' style='position: absolute; top: 130px; left: 0; z-index:999'>0</span>";
    $("body").prepend($(html));
    $(document).keypress(function(e) {
        pause = !pause;
        $("#span").html(pause ? "pause" : "play");
    });
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

function distance(x1, y1, x2, y2) {
    return Math.sqrt((x2-x1)*(x2-x1)+(y2-y1)*(y2-y1));
}

function playerDistanceTo(x, y) {
    return distance(game_state.players[player].pos.x, game_state.players[player].pos.y, x, y);
}

function isWeaker(enemy) {
    var target = "R";
    if(game_state.players[player].class == "R") {
        target = "S";
    } else if(game_state.players[player].class == "S") {
        target = "P"
    }
    if(enemy.class == target) {
        return true;
    }
    if(enemy.class == game_state.players[player].class && enemy.HP < game_state.players[player].HP * 0.75) {
        return true;
    }
    return false;
}

function isInSafeZone(x, y) {
    var r = game_state.gas_area.r * game.scale.gameSize._height / 6;
    var d = distance(x, y, game_state.gas_area.x, game_state.gas_area.y);
    return(d < r);
}

function printStats() {
    var totalPartidas = wins + loses;
    var duracionTotal = (new Date() - start) / 1000;
    var duracionMedia = duracionTotal / totalPartidas;
    console.log("W:" + wins + " L:" + loses + " media:" + parseInt(duracionMedia) + "s");
}

function isSafeToGo(x, y) {
    for(var e in game_state.players) {
        if (e != player) {
            if (!isWeaker(game_state.players[e]) && game_state.players[e].HP > 0) {
                if(isInWay(x, y, e)) {
                    return false;
                }
            }
        }
    }
    return true;
}

function isInWay(x, y, e) {
    var min = 1.2;
    var d1 = playerDistanceTo(x, y);
    var d2 = playerDistanceTo(game_state.players[e].pos.x, game_state.players[e].pos.y);
    var d3 = distance(game_state.players[e].pos.x, game_state.players[e].pos.y, x, y);
    return ((d2 + d3) / d1) < min;
}
