/**
 * game/character/ball.js
 * 
 * What it Does:
 *   This file is a basic ball character
 *   it extends the Sprite class and adds two collision detections methods
 * 
 * What to Change:
 *   Add any character specific methods
 *   eg. eat
 * 
 */

import ImageSprite from '../objects/imageSprite.js';

class Ball extends ImageSprite {
    constructor(options) {
        super(options);

        this.dx = -1;
        // this.dy = -1;
        this.dy = 0;
        this.launched = false;
    }

    move(m) {
        if (!this.launched) { return; }

        super.move(this.dx, this.dy, m);
    }

    launch(delay, dx, offset) {
        let totalOffset = (offset + this.width) * dx;

        this.stop();
        if (delay) {
            setTimeout(() => {
                this.launched = true;
                this.x = this.x + totalOffset;
                this.dx = dx;
            }, delay);
        } else {
            this.launched = true;
            this.x = this.x + totalOffset;
            this.dx = dx;
        }
    }

    stop() {
        this.launched = false;
        this.dx = 0;
    }

    collisionsWith(entities) {
        let result = entities
        .find((ent) => { return this.collidesWith(ent); });

        return result;
    };

    collidesWith(entity) {
        let distanceX = Math.abs(entity.cx - this.cx);
        let onY = this.cy > entity.y && this.cy < entity.y + entity.height;

        return onY && distanceX < (entity.width  + this.width) / 2;
    }
}

export default Ball;