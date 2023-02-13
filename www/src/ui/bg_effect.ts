
var mouseX = null;
var mouseY = null;
var mouseDist = 150;

var onResize;
var onMouseMove;
var onTouchMove;

const ease = 0.3;
const friction = 0.2;
var lineWidth = 1;

var dist = 80;
var lessThan;
var shapeNum;

var shapes = [];

// Shape
class Shape {
    [key: string]: any;

    constructor(ctx, x, y, i) {
        this.ctx = ctx;
        this.init(x, y, i);
    }

    init(x, y, i) {
        this.x = x;
        this.y = y;
        this.xi = x;
        this.yi = y;
        this.i = i;
        this.r = 1;
        this.v = {
            x: 0,
            y: 0
        };
        this.c = this.rand(0, 360);
    };

    draw() {
        var ctx = this.ctx;
        ctx.save();
        ctx.fillStyle = 'hsl(' + this.c + ', ' + '80%, 60%)';
        ctx.beginPath();
        ctx.arc(this.x, this.y, this.r, 0, Math.PI * 2, false);
        ctx.fill();
        ctx.restore();
    };

    mouseDist() {
        var x = mouseX - this.x;
        var y = mouseY - this.y;
        var d = x * x + y * y;
        var dist = Math.sqrt(d);
        if (dist < mouseDist) {
            this.v.x = +this.v.x;
            this.v.y = +this.v.y;
            var colAngle = Math.atan2(mouseY - this.y, mouseX - this.x);
            this.v.x = -Math.cos(colAngle) * 5;
            this.v.y = -Math.sin(colAngle) * 5;
            this.x += this.v.x;
            this.y += this.v.y;
        } else if (dist > mouseDist && dist < mouseDist + 10) {
            this.v.x = 0;
            this.v.y = 0;
        } else {
            this.v.x += (this.xi - this.x) * ease;
            this.v.y += (this.yi - this.y) * ease;
            this.v.x *= friction;
            this.v.y *= friction;
            this.x += this.v.x;
            this.y += this.v.y;
        }
    }

    drawLine(j) {
        for (var i = 0; i < shapes.length; i++) {
            if (i !== j) {
                var x = this.x - shapes[i].x;
                var y = this.y - shapes[i].y;
                var d = x * x + y * y;
                var dist = Math.floor(Math.sqrt(d));
                if (dist <= lessThan) {
                    this.ctx.save();
                    this.ctx.lineWidth = lineWidth;
                    this.ctx.strokeStyle = 'hsl(' + this.c + ', ' + '80%, 60%)';
                    this.ctx.beginPath();
                    this.ctx.moveTo(this.x, this.y);
                    this.ctx.lineTo(shapes[i].x, shapes[i].y);
                    this.ctx.stroke();
                    this.ctx.restore();
                }
            }
        }
    }

    render(i) {
        this.drawLine(i);
        if (mouseX !== null) this.mouseDist();
        this.draw();
    }

    // Random Number
    rand(min, max) {
        return Math.floor(Math.random() * (max - min + 1) + min);
    }

}

// background animation effect
export class BgEffect {
    [key: string]: any;

    constructor() {

        this.active = true;
        this.canvas = document.getElementById('bg-canvas');

        // vars
        this.ctx = this.canvas.getContext('2d');
        this.X = this.canvas.width = window.innerWidth;
        this.Y = this.canvas.height = window.innerHeight;
        dist = 80;
        lessThan = Math.sqrt(dist * dist + dist * dist);
        this.X > this.Y ? shapeNum = this.X / dist : shapeNum = this.Y / dist;

        if (this.X < 768) {
            lineWidth = 1;
            dist = 40;
            lessThan = Math.sqrt(dist * dist + dist * dist);
            mouseDist = 50;
            this.X > this.Y ? shapeNum = this.X / dist : shapeNum = this.Y / dist;
        }

        // Animation
        window.requestAnimationFrame =
            window.requestAnimationFrame ||
            window.mozRequestAnimationFrame ||
            window.webkitRequestAnimationFrame ||
            window.msRequestAnimationFrame ||
            function (cb) {
                setTimeout(cb, 17);
            };

        for (var i = 0; i < shapeNum + 1; i++) {
            for (var j = 0; j < shapeNum + 1; j++) {
                if (j * dist - dist > this.Y) break;
                var s = new Shape(this.ctx, i * dist, j * dist, i, j, shapes);
                shapes.push(s);
            }
        }

        this.render();

        //
        onResize = this.onResize.bind(this);
        onMouseMove = this.onMouseMove.bind(this);
        onTouchMove = this.onResize.bind(this);

        window.addEventListener('resize', onResize);
        window.addEventListener('mousemove', onMouseMove, false);
        this.canvas.addEventListener('touchmove', onTouchMove);

    }

    onMouseMove(e) {
        mouseX = e.clientX;
        mouseY = e.clientY;
    }

    onTouchMove(e) {
        var touch = e.targetTouches[0];
        mouseX = touch.pageX;
        mouseY = touch.pageY;
    }

    // Event
    onResize() {
        if(!this.active) {
            return false;
        }
        this.X = this.canvas.width = window.innerWidth;
        this.Y = this.canvas.height = window.innerHeight;
        shapes = [];
        if (this.X < 768) {
            lineWidth = 1;
            dist = 40;
            mouseDist = 50;
            lessThan = Math.sqrt(dist * dist + dist * dist);
            this.X > this.Y ? shapeNum = this.X / dist : shapeNum = this.Y / dist;
        } else {
            lineWidth = 1;
            dist = Math.max(Math.floor(this.X) / 16, 80);
            mouseDist = dist * 1.875; // 150;
            lessThan = Math.sqrt(dist * dist + dist * dist);
            this.X > this.Y ? shapeNum = this.X / dist : shapeNum = this.Y / dist;
        }
        for (var i = 0; i < shapeNum + 1; i++) {
            for (var j = 0; j < shapeNum + 1; j++) {
                if (j * dist - dist > this.Y) break;
                var s = new Shape(this.ctx, i * dist, j * dist, i, j);
                shapes.push(s);
            }
        }
    }

    // Render
    render() {
        this.ctx.clearRect(0, 0, this.X, this.Y);
        for(var i = 0; i < shapes.length; i++) {
            shapes[i].render(i);
        }
        if(this.active) {
            requestAnimationFrame(() => {
                this.render();
            });
        }
    }

    stop() {
        this.active = false;
        window.removeEventListener('resize', onResize);
        window.removeEventListener('mousemove', onMouseMove);
        this.canvas.removeEventListener('touchmove', onTouchMove);

    }

}