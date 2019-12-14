/**
 * game/main.js
 * 
 * What it Does:
 *   This file is the main game class
 *   Important parts are the load, create, and play functions
 *   
 *   Load: is where images, sounds, and fonts are loaded
 *   
 *   Create: is where game elements and characters are created
 *   
 *   Play: is where game characters are updated according to game play
 *   before drawing a new frame to the screen, and calling play again
 *   this creates an animation just like the pages of a flip book
 * 
 *   Other parts include boilerplate for requesting and canceling new frames
 *   handling input events, pausing, muting, etc.
 * 
 * What to Change:
 *   Most things to change will be in the play function
 */

import Koji from 'koji-tools';

import {
    requestAnimationFrame,
    cancelAnimationFrame
} from './helpers/animationframe.js';

import {
    loadList,
    loadImage,
    loadSound,
    loadFont
} from 'game-asset-loader';

import audioContext from 'audio-context';
import audioPlayback from 'audio-play';
import unlockAudioContext from 'unlock-audio-context';

import preventParent from 'prevent-parent';

import { boundBy, hashCode } from './helpers/utils.js';

import Image from './objects/image.js';
import Player from './characters/player.js';
import Ball from './characters/ball.js';

class Game {

    constructor(canvas, overlay, topbar, config) {
        this.config = config; // customization
        this.topbar = topbar;
        this.overlay = overlay;

        this.prefix = hashCode(this.config.settings.name); // set prefix for local-storage keys

        this.canvas = canvas; // game screen
        this.ctx = canvas.getContext("2d"); // game screen context

        this.audioCtx = audioContext(); // create new audio context
        unlockAudioContext(this.audioCtx);
        this.playlist = [];

	// prevent parent wondow form scrolling
	preventParent();

        // frame count, rate, and time
        // this is just a place to keep track of frame rate (not set it)
        this.frame = {
            count: 0,
            time: Date.now(),
            rate: null,
            scale: null
        };

        // game settings
        this.state = {
            current: 'loading',
            prev: null,
            paused: false,
            muted: localStorage.getItem(this.prefix.concat('muted')) === 'true'
        };

        this.input = {
            active: true,
            current: 'keyboard',
            keyboard: { up: false, right: false, left: false, down: false },
            mouse: { x: 0, y: 0, click: false },
            touch: { x: 0, y: 0 },
        };

        this.input2 = {
            active: false,
            current: 'keyboard',
            keyboard: { up: false, right: false, left: false, down: false }
        }


        this.images = {}; // place to keep images
        this.sounds = {}; // place to keep sounds
        this.fonts = {}; // place to keep fonts

        // setup event listeners
        // handle keyboard events
        document.addEventListener('keydown', ({ code }) => this.handleKeyboardInput('keydown', code));
        document.addEventListener('keyup', ({ code }) => this.handleKeyboardInput('keyup', code));

        // setup event listeners for mouse movement
        document.addEventListener('mousemove', ({ clientY }) => this.handleMouseMove(clientY));

        // setup event listeners for mouse movement
        document.addEventListener('touchmove', ({ touches }) => this.handleTouchMove(touches[0]));

        // handle overlay clicks
        this.overlay.root.addEventListener('click', ({ target }) => this.handleClicks(target));

        // handle resize events
        window.addEventListener('resize', () => this.handleResize());
        window.addEventListener("orientationchange", (e) => this.handleResize(e));

        // handle koji config changes
        Koji.on('change', (scope, key, value) => {
            console.log('updating configs...', scope, key, value);
            this.config[scope][key] = value;
            this.cancelFrame(this.frame.count - 1);
            this.load();
        });
    }

    load() {
        // load pictures, sounds, and fonts

        // set topbar and topbar color
        this.topbar.active = this.config.settings.gameTopBar;
        this.topbar.style.display = this.topbar.active ? 'block' : 'none';
        this.topbar.style.backgroundColor = this.config.colors.primaryColor;

        this.canvas.width = window.innerWidth; // set game screen width
        this.canvas.height = this.topbar.active ? window.innerHeight - this.topbar.clientHeight : window.innerHeight; // set game screen height

        this.screen = {
            top: 0,
            bottom: this.canvas.height,
            left: 0,
            right: this.canvas.width,
            centerX: this.canvas.width / 2,
            centerY: this.canvas.height / 2,
            scale: ((this.canvas.width + this.canvas.height) / 2) * 0.003
        };



        // set loading indicator to textColor
        document.querySelector('#loading').style.color = this.config.colors.textColor;

        // set winscore
        this.setState({ winScore: parseInt(this.config.settings.winScore) });

        // set overlay styles
        this.overlay.setStyles({...this.config.colors, ...this.config.settings});
        
        // make a list of assets
        const gameAssets = [
            loadImage('backgroundImage', this.config.images.backgroundImage),
            loadImage('ballImage', this.config.images.ballImage),
            loadSound('bounceSound', this.config.sounds.bounceSound),
            loadSound('scoreSound', this.config.sounds.scoreSound),
            loadSound('backgroundMusic', this.config.sounds.backgroundMusic),
            loadFont('gameFont', this.config.settings.fontFamily)
        ];

        // put the loaded assets the respective containers
        loadList(gameAssets, (progress) => {
            document.getElementById('loading-progress').textContent = `${progress.percent}%`;
        })
        .then((assets) => {

            this.images = assets.image;
            this.sounds = assets.sound;

        })
        .then(() => this.create())
        .catch(err => console.error(err));
    }

    create() {
        // create game characters

        const { scale, centerY, right } = this.screen;
        const { playerHeight, playerWidth } = this.config.settings

        let pHeight = playerHeight * scale;
        let pWidth = playerWidth * scale;

        this.player1 = new Player({
            name: 'player1',
            ctx: this.ctx,
            color: this.config.colors.rightPaddleColor,
            x: right - pWidth,
            y: centerY - pHeight / 2,
            width: pWidth,
            height: pHeight,
            speed: 50,
            bounds: this.screen
        })

        this.player2 = new Player({
            name: 'player2',
            ctx: this.ctx,
            color: this.config.colors.leftPaddleColor,
            x: 0,
            y: centerY - pHeight / 2,
            width: pWidth,
            height: pHeight,
            speed: 50,
            bounds: this.screen
        });

        // ball
        let ballSpeed = parseInt(this.config.settings.ballSpeed);
        let ballSize = parseInt(this.config.settings.ballSize);

        let ballWidth =  ballSize * scale;
        let ballHeight = ballSize * scale;

        this.ball = new Ball({
            ctx: this.ctx,
            image: this.images.ballImage,
            x: this.screen.right + ballWidth,
            y: this.player1.y,
            width: ballWidth,
            height: ballHeight,
            speed: ballSpeed,
            bounds: {
                top: 0,
                right: this.screen.right + ballWidth,
                left: this.screen.left - ballWidth,
                bottom: this.screen.bottom
            }
        })

        // background
        this.background = new Image({
            ctx: this.ctx,
            image: this.images.backgroundImage,
            x: 0,
            y: 0,
            width: this.screen.right,
            height: this.screen.bottom
        });

        // set game state ready
        this.setState({ current: 'ready' });
        this.play();
    }

    play() {
        // update game characters

        // clear the screen of the last picture
        this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);

        // draw and do stuff that you need to do
        // no matter the game state
        if (this.background) {
            this.background.draw();
        }

        // update scores
        this.overlay.setScore1(`${this.player1.score}/${this.state.winScore}`);
        this.overlay.setScore2(`${this.player2.score}/${this.state.winScore}`);

        // ready to play
        if (this.state.current === 'ready' && this.state.prev === 'loading') {
            this.overlay.hideLoading();
            this.canvas.style.opacity = 1;

            this.overlay.setBanner(this.config.settings.name);
            this.overlay.setButton(this.config.settings.startText);
            this.overlay.showStats();

            this.overlay.setMute(this.state.muted);
            this.overlay.setPause(this.state.paused);

            this.overlay.setInstructions({
                desktop: this.config.settings.instructionsDesktop,
                mobile: this.config.settings.instructionsMobile
            });

            this.setState({ current: 'ready' });
        }

        // game play
        if (this.state.current === 'play') {
            // hide overlays if coming from ready
            if (this.state.prev === 'ready') {
                this.overlay.hideBanner();
                this.overlay.hideButton();
                this.overlay.hideInstructions();
            }

            // check for winner
            if (this.player1.score === this.state.winScore) {
                this.setState({ current: 'win-player1'})
            }

            if (this.player2.score === this.state.winScore) {
                this.setState({ current: 'win-player2'})
            }


            if (!this.state.muted && !this.state.backgroundMusic) {
                let sound = this.sounds.backgroundMusic;
                this.state.backgroundMusic = audioPlayback(sound, {
                    start: 0,
                    end: sound.duration,
                    loop: true,
                    context: this.audioCtx
                });
            }

            // player 1
            if (this.input.current === 'keyboard') {
                let dy1 = (this.input.keyboard.up ? -1 : 0) + (this.input.keyboard.down ? 1 : 0);
                this.player1.move(0, dy1, this.frame.scale);
            }

            if (this.input.current === 'mouse') {
                let y = this.input.mouse.y - this.canvas.offsetTop;
                let diffY =  y - this.player1.y - this.player1.height / 2;
                this.player1.move(0, diffY / 100, 1);
            }
            
            if (this.input.current === 'touch') {
                let y = this.input.touch.y - this.canvas.offsetTop;
                let diffY =  y - this.player1.y - this.player1.height / 2;
                this.player1.move(0, diffY / 100, 1);
            }

            this.player1.draw();

            // player 2: computer
            if (!this.input2.active && this.ball.launched && this.ball.dx < 0) {
               
                // move computer player toward the ball
                // get diffY and calculate dy
                let diffY = this.ball.y / 2 - this.player2.y;
                let dy2 = diffY / (this.ball.x * 2); 

                // apply a difficulty/speed limit
                let difficulty = parseInt(this.config.settings);
                let speedLimit = difficulty / 2;
                let dy2capped = boundBy(dy2, speedLimit, -speedLimit);
                this.player2.move(0, dy2capped, this.frame.scale);
            }

            // player 2: human
            if (this.input2.active) {
                // move player 2
                let dy2 = (this.input2.keyboard.up ? -1 : 0) + (this.input2.keyboard.down ? 1 : 0);
                this.player2.move(0, dy2, this.frame.scale);
            }

            this.player2.draw();

            // ball
            // bounce ball off of ceiling or floor
            let onEdgeY = this.ball.y === this.screen.top || this.ball.y === this.screen.bottom - this.ball.height;
            if (onEdgeY) { this.ball.dy = -this.ball.dy; }

            // bounce ball off player1
            let collided = this.ball.collisionsWith([this.player1, this.player2]);
            if (collided && collided.name === 'player1') {
                // play bounce sound
                this.playback('bounceSound', this.sounds.bounceSound);

                // add some velocity
                // change ball direction
                // add some speed
                this.ball.dx = -1;
                this.ball.speed += 1;
            }

            // bounce ball off player2
            if (collided && collided.name === 'player2') {
                // play bounce sound
                this.playback('bounceSound', this.sounds.bounceSound);

                // change ball direction
                // add some speed to ball
                this.ball.dx = 1;
                this.ball.speed += 10;
                this.ball.stop();
                setTimeout(() => {
                   // this.ball.setY(-100);
                   this.reset();
                   /*this.playback('scoreSound', this.sounds.scoreSound);
                   this.player1.score += 1;
                   this.ball.speed = parseInt(this.config.settings.ballSpeed);
                   */
                }, 1000);
            }

            // if ball touches left side, player1 scores
            if (this.ball.launched && this.ball.x <= this.ball.bounds.left) {
                // play score sound
                this.playback('scoreSound', this.sounds.scoreSound);

                // give player1 one point
                this.player2.score += 1;

                // reset ball speed
                this.ball.speed = parseInt(this.config.settings.ballSpeed);

                if (this.input2.active) {
                    // wait for player2 human to relaunch

                    this.ball.stop();
                } else {
                    // player2 computer to relaunch after 3 seconds

                    this.ball.setY(this.player2.y);
                    this.ball.launch(3000, 1, this.player2.width);
                }
                setTimeout(() => {
                   this.reset();
                }, 1000);
            }

            // if ball touches right side, player2 scores
            if (this.ball.launched && 
                this.ball.x + this.ball.width >= this.ball.bounds.right) {
                // play score sound
                this.playback('scoreSound', this.sounds.scoreSound);

                // give player2 one point
                this.player2.score += 1;

                // reset ball speed
                this.ball.speed = parseInt(this.config.settings.ballSpeed);

                this.ball.stop();
            }

            this.ball.move(this.frame.scale);
            this.ball.draw();
        }

        // player wins
        if (this.state.current === 'win-player1') {
            this.overlay.setBanner(this.config.settings.player1WinText);
        }

        if (this.state.current === 'win-player2') {
            this.overlay.setBanner(this.config.settings.player2WinText);
        }

        // draw the next screen
        this.requestFrame(() => this.play());
    }

    relaunchBall(side) {
        // ignore if ball is launched
        if (this.ball.launched) { return; }

        // reset ball speed
        this.ball.speed = parseInt(this.config.settings.ballSpeed);

        // launch from right
        if (side === 'right') {
            this.ball.setY(this.player1.y);
            this.ball.launch(null, -1, this.player1.width);
        }

        // launch from left
        if (side === 'left') {
            this.ball.setY(this.player2.y);
            this.ball.launch(null, 1, this.player2.width);
        }

    }

    // event listeners
    handleClicks(target) {
        if (this.state.current === 'loading') { return; }

        // mute
        if (target.id === 'mute') {
            this.mute();
            return;
        }

        // pause
        if (target.id === 'pause') {
            this.pause();
            return;
        }

        // button
        if ( target.id === 'button') {
            this.setState({ current: 'play' });
            return;
        }

        // relaunch ball
        let onSide = this.ball.launched === false && this.ball.x > this.screen.centerX;
        if (this.state.current === 'play' && onSide) {
            this.relaunchBall('right');
        }

        if (this.state.current.includes('win')) {
            document.location.reload();
        }
    }

    handleKeyboardInput(type, code) {
        this.input.current = 'keyboard';

        // player 1
        if (type === 'keydown') {
            if (code === 'ArrowUp') {
                this.input.keyboard.up = true
            }
            if (code === 'ArrowDown') {
                this.input.keyboard.down = true
            }
        }

        if (type === 'keyup') {
            if (code === 'ArrowUp') {
                this.input.keyboard.up = false
            }
            if (code === 'ArrowDown') {
                this.input.keyboard.down = false
            }

            // relaunch player 1
            if (code === 'Space') {
                let rightSide = this.ball.launched === false && this.ball.x > this.screen.centerX;
                if (this.state.current === 'play' && rightSide) {
                    this.relaunchBall('right')
                }
            }
        }



        // player 2
        if (type === 'keydown') {
            if (code === 'KeyW') {
                this.input2.keyboard.up = true;
            }
            if (code === 'KeyS') {
                this.input2.keyboard.down = true;
            }

            // relaunch player 2
            if (code === 'ShiftLeft') {
                let rightSide = this.ball.launched === false && this.ball.x > this.screen.centerX;
                if (this.state.current === 'play' && !rightSide) {
                    this.relaunchBall('left')
                }
            }
        }

        if (type === 'keyup') {
            if (code === 'KeyW') {
                this.input2.keyboard.up = false;
            }
            if (code === 'KeyS') {
                this.input2.keyboard.down = false;
            }

        }

        // game state

        // switch to 2 player if W or S are pressed
        if (type === 'keydown' && ['KeyW', 'KeyS'].includes(code) && !this.input2.active) {
            this.input2.active = true;
        }

        // pause and play game if P is pressed
        if (type === 'keydown' && code === 'KeyP') { this.pause(); }

        // reload game after win and Spacebar pressed
        if (type === 'keyup' && code === 'Space' && this.state.current.includes('win')) {
            document.location.reload();
        }
    }

    handleMouseMove(y) {
        this.input.current = 'mouse';
        this.input.mouse.y = y;
    }

    handleTouchMove(touch) {
        let { clientY } = touch;

        this.input.current = 'touch';
        this.input.touch.y = clientY;
    }

    handleResize() {

        document.location.reload();
    }

    // game helpers
    // method:pause pause game
    pause() {
        if (this.state.current != 'play') { return; }

        this.state.paused = !this.state.paused;
        this.overlay.setPause(this.state.paused);

        if (this.state.paused) {
            // pause game loop
            this.cancelFrame(this.frame.count - 1);

            // mute all game sounds
            this.audioCtx.suspend();

            this.overlay.setBanner('Paused');
        } else {
            // resume game loop
            this.requestFrame(() => this.play(), true);

            // resume game sounds if game not muted
            if (!this.state.muted) {
                this.audioCtx.resume();
            }

            this.overlay.hide('banner');
        }
    }

    // method:mute mute game
    mute() {
        let key = this.prefix.concat('muted');
        localStorage.setItem(
            key,
            localStorage.getItem(key) === 'true' ? 'false' : 'true'
        );
        this.state.muted = localStorage.getItem(key) === 'true';

        this.overlay.setMute(this.state.muted);

        if (this.state.muted) {
            // mute all game sounds
            this.audioCtx.suspend();
        } else {
            // unmute all game sounds
            if (!this.state.paused) {
                this.audioCtx.resume();
            }
        }
    }

    playback(key, audioBuffer, options = {}) {
        if (this.state.muted) { return; }
        let id = Math.random().toString(16).slice(2);
        this.playlist.push({
            id: id,
            key: key,
            playback: audioPlayback(audioBuffer, {
                ...{
                    start: 0,
                    end: audioBuffer.duration,
                    context: this.audioCtx
                },
                ...options
            }, () => {
                // remove played sound from playlist
                this.playlist = this.playlist
                    .filter(s => s.id != id);
            })
        });
    }

    stopPlayback(key) {
        this.playlist = this.playlist
        .filter(s => {
            let targetBuffer = s.key === key;
            if (targetBuffer) {
                s.playback.pause();
            }
            return targetBuffer;
        })
    }

    // reset game
    reset() {
        document.location.reload();
    }

    // update game state
    setState(state) {
        this.state = {
            ...this.state,
            ...{ prev: this.state.current },
            ...state,
        };
    }

    // request new frame
    // wraps requestAnimationFrame.
    // see game/helpers/animationframe.js for more information
    requestFrame(next, resumed) {
        let now = Date.now();
        this.frame = {
            count: requestAnimationFrame(next),
            time: now,
            rate: resumed ? 0 : now - this.frame.time,
            scale: this.screen.scale * this.frame.rate * 0.01
        };
    }

    // cancel frame
    // wraps cancelAnimationFrame.
    // see game/helpers/animationframe.js for more information
    cancelFrame() {
        cancelAnimationFrame(this.frame.count);
    }
}

export default Game;
