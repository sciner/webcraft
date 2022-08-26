export class JoystickController {

    constructor(stickID, maxDistance, deadzone, player, kb, callback) {

        this.player = player;
        this.kb = kb;
        this.value = null;
        this.id = stickID;
        let stick = document.getElementById(stickID);
        
        if(!stick) {
            return;
        }

        this.callback = callback;
        // location from which drag begins, used to calculate offsets
        this.dragStart = null;
        // track touch identifier in case multiple joysticks present
        this.touchId = null;
        this.active = false;
        this.value = { x: 0, y: 0 }; 
        let self = this;

        function handleDown(event) {
            self.active = true;
            // all drag movements are instantaneous
            stick.style.transition = '0s';
            // touch event fired before mouse event; prevent redundant mouse event from firing
            event.preventDefault();
            if (event.changedTouches) {
                self.dragStart = { x: event.changedTouches[0].clientX, y: event.changedTouches[0].clientY };
            } else {
                self.dragStart = { x: event.clientX, y: event.clientY };
            }
            // if this is a touch event, keep track of which one
            if (event.changedTouches) {
                self.touchId = event.changedTouches[0].identifier;
            }
        }

        function handleMove(event)  {
            if ( !self.active ) return;
            // if this is a touch event, make sure it is the right one
            // also handle multiple simultaneous touchmove events
            let touchmoveId = null;
            if (event.changedTouches) {
                for (let i = 0; i < event.changedTouches.length; i++) {
                    if (self.touchId == event.changedTouches[i].identifier) {
                        touchmoveId = i;
                        event.clientX = event.changedTouches[i].clientX;
                        event.clientY = event.changedTouches[i].clientY;
                    }
                }
                if (touchmoveId == null) return;
            }
            const xDiff = event.clientX - self.dragStart.x;
            const yDiff = event.clientY - self.dragStart.y;
            const angle = Math.atan2(yDiff, xDiff);
            const distance = Math.min(maxDistance, Math.hypot(xDiff, yDiff));
            const xPosition = distance * Math.cos(angle);
            const yPosition = distance * Math.sin(angle);
            // move stick image to new position
            stick.style.transform = `translate3d(${xPosition}px, ${yPosition}px, 0px)`;
            // deadzone adjustment
            const distance2 = (distance < deadzone) ? 0 : maxDistance / (maxDistance - deadzone) * (distance - deadzone);
            const xPosition2 = distance2 * Math.cos(angle);
            const yPosition2 = distance2 * Math.sin(angle);
            const xPercent = parseFloat((xPosition2 / maxDistance).toFixed(4));
            const yPercent = parseFloat((yPosition2 / maxDistance).toFixed(4));
            self.value = { x: xPercent, y: yPercent };
            self.callback(self.value);
        }

        function handleUp(event)  {
            if ( !self.active ) {
                return;
            }
            // if this is a touch event, make sure it is the right one
            if (event.changedTouches && self.touchId != event.changedTouches[0].identifier) {
                return;
            }
            // transition the joystick position back to center
            stick.style.transition = '.2s';
            stick.style.transform = `translate3d(0px, 0px, 0px)`;
            // reset everything
            self.value = { x: 0, y: 0 };
            self.callback(self.value);
            self.touchId = null;
            self.active = false;
        }

        stick.addEventListener('mousedown', handleDown);
        stick.addEventListener('touchstart', handleDown);
        document.addEventListener('mousemove', handleMove, {passive: false});
        document.addEventListener('touchmove', handleMove, {passive: false});
        document.addEventListener('mouseup', handleUp);
        document.addEventListener('touchend', handleUp);
    }

    action(name, state) {
        // console.log(state, name);
        const player = this.player;
        const kb = this.kb;
        const pickAt = player.pickAt;
        switch(name) {
            case 'atack': {
                const button_id = 1;
                const shiftKey = false;
                if(state) {
                    pickAt.setEvent({button_id: button_id, shiftKey: shiftKey});
                } else {
                    pickAt.clearEvent();
                }
                break;
            }
            case 'jump': {
                kb.keys[KEY.SPACE] = state;
                break;
            }
            case 'walk': {
                kb.keys[KEY.W] = state;
                break;
            }
            case 'place': {
                let button_id = 3;
                let shiftKey = false;
                if(state) {
                    pickAt.setEvent({button_id: button_id, shiftKey: shiftKey});
                } else {
                    pickAt.clearEvent();
                }
                break;
            }
        }
    }

}