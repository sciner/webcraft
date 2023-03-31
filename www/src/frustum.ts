import {Vector} from "./helpers.js";

export class Sphere {
    center: Vector;
    radius: number;
    _temp: Sphere

    constructor(center : Vector, radius : number) {
        this.center = center;
        this.radius = radius;
    }

}

export class Plane {
    normal: Vector;
    constant: number;
    isPlane: boolean;

	constructor( normal = new Vector( 1, 0, 0 ), constant = 0 ) {
		// normal is assumed to be normalized
		this.normal = normal;
		this.constant = constant;
	}

	set( normal, constant ) {
		this.normal.copyFrom( normal );
		this.constant = constant;
		return this;
	}

	setComponents( x, y, z, w ) {
		this.normal.set( x, y, z );
		this.constant = w;
		return this;
	}

	setFromNormalAndCoplanarPoint( normal, point ) {
		this.normal.copyFrom( normal );
		this.constant = - point.dot( this.normal );
		return this;
	}

	// setFromCoplanarPoints( a, b, c ) {
	// 	const normal = _vector1.subVectors( c, b ).cross( _vector2.subVectors( a, b ) ).normalize();
	// 	// Q: should an error be thrown if normal is zero (e.g. degenerate plane)?
	// 	this.setFromNormalAndCoplanarPoint( normal, a );
	// 	return this;
	// }

	copy( plane ) {
		this.normal.copyFrom( plane.normal );
		this.constant = plane.constant;
		return this;
	}

	normalize() {
		// Note: will lead to a divide by zero if the plane is invalid.
		const inverseNormalLength = 1.0 / this.normal.length();
		this.normal.multiplyScalarSelf( inverseNormalLength );
		this.constant *= inverseNormalLength;
		return this;
	}

	// negate() {
	// 	this.constant *= - 1;
	// 	this.normal.negate();
	// 	return this;
	// }

	distanceToPoint( point ) {
		return this.normal.dot( point ) + this.constant;
	}

	distanceToSphere( sphere ) {
		return this.distanceToPoint( sphere.center ) - sphere.radius;
	}

	projectPoint( point, target ) {
		return target.copyFrom( this.normal ).multiplyScalarSelf( - this.distanceToPoint( point ) ).add( point );
	}

	// intersectLine( line, target ) {
	// 	const direction = line.delta( _vector1 );
	// 	const denominator = this.normal.dot( direction );
	// 	if ( denominator === 0 ) {
	// 		// line is coplanar, return origin
	// 		if ( this.distanceToPoint( line.start ) === 0 ) {
	// 			return target.copyFrom( line.start );
	// 		}
	// 		// Unsure if this is the correct method to handle this case.
	// 		return null;
	// 	}
	// 	const t = - ( line.start.dot( this.normal ) + this.constant ) / denominator;
	// 	if ( t < 0 || t > 1 ) {
	// 		return null;
	// 	}
	// 	return target.copyFrom( direction ).multiplyScalarSelf( t ).add( line.start );
	// }

	intersectsLine( line ) {
		// Note: this tests if a line intersects the plane, not whether it (or its end-points) are coplanar with it.
		const startSign = this.distanceToPoint( line.start );
		const endSign = this.distanceToPoint( line.end );
		return ( startSign < 0 && endSign > 0 ) || ( endSign < 0 && startSign > 0 );
	}

	intersectsBox( box ) {
		return box.intersectsPlane( this );
	}

	intersectsSphere( sphere ) {
		return sphere.intersectsPlane( this );
	}

	coplanarPoint( target ) {
		return target.copyFrom( this.normal ).multiplyScalarSelf( - this.constant );
	}

	// applyMatrix4( matrix, optionalNormalMatrix ) {
	// 	const normalMatrix = optionalNormalMatrix || _normalMatrix.getNormalMatrix( matrix );
	// 	const referencePoint = this.coplanarPoint( _vector1 ).applyMatrix4( matrix );
	// 	const normal = this.normal.applyMatrix3( normalMatrix ).normalize();
	// 	this.constant = - referencePoint.dot( normal );
	// 	return this;
	// }

	translate( offset ) {
		this.constant -= offset.dot( this.normal );
		return this;
	}

	equals( plane ) {
		return plane.normal.equals( this.normal ) && ( plane.constant === this.constant );
	}

	// clone() {
	// 	return new this.constructor().copyFrom( this );
	// }

}

Plane.prototype.isPlane = true;

class Frustum {
    [key: string]: any;

	constructor( p0 = new Plane(), p1 = new Plane(), p2 = new Plane(), p3 = new Plane(), p4 = new Plane(), p5 = new Plane() ) {
		this.planes = [ p0, p1, p2, p3, p4, p5 ];
	}

	set( p0, p1, p2, p3, p4, p5 ) {
		const planes = this.planes;
		planes[ 0 ].copyFrom( p0 );
		planes[ 1 ].copyFrom( p1 );
		planes[ 2 ].copyFrom( p2 );
		planes[ 3 ].copyFrom( p3 );
		planes[ 4 ].copyFrom( p4 );
		planes[ 5 ].copyFrom( p5 );
		return this;
	}

	copy( frustum ) {
		const planes = this.planes;
		for ( let i = 0; i < 6; i ++ ) {
			planes[ i ].copyFrom( frustum.planes[ i ] );
		}
		return this;
	}

	setFromProjectionMatrix( m ) {
		const planes = this.planes;
		const me = m;//.elements;
		const me0 = me[ 0 ], me1 = me[ 1 ], me2 = me[ 2 ], me3 = me[ 3 ];
		const me4 = me[ 4 ], me5 = me[ 5 ], me6 = me[ 6 ], me7 = me[ 7 ];
		const me8 = me[ 8 ], me9 = me[ 9 ], me10 = me[ 10 ], me11 = me[ 11 ];
		const me12 = me[ 12 ], me13 = me[ 13 ], me14 = me[ 14 ], me15 = me[ 15 ];
		planes[ 0 ].setComponents( me3 - me0, me7 - me4, me11 - me8, me15 - me12 ).normalize();
		planes[ 1 ].setComponents( me3 + me0, me7 + me4, me11 + me8, me15 + me12 ).normalize();
		planes[ 2 ].setComponents( me3 + me1, me7 + me5, me11 + me9, me15 + me13 ).normalize();
		planes[ 3 ].setComponents( me3 - me1, me7 - me5, me11 - me9, me15 - me13 ).normalize();
		planes[ 4 ].setComponents( me3 - me2, me7 - me6, me11 - me10, me15 - me14 ).normalize();
		planes[ 5 ].setComponents( me3 + me2, me7 + me6, me11 + me10, me15 + me14 ).normalize();
		return this;
	}

	// intersectsObject( object ) {
	// 	const geometry = object.geometry;
	// 	if ( geometry.boundingSphere === null ) geometry.computeBoundingSphere();
	// 	_sphere.copyFrom( geometry.boundingSphere ).applyMatrix4( object.matrixWorld );
	// 	return this.intersectsSphere( _sphere );
	// }

	// intersectsSprite( sprite ) {
	// 	_sphere.center.set( 0, 0, 0 );
	// 	_sphere.radius = 0.7071067811865476;
	// 	_sphere.applyMatrix4( sprite.matrixWorld );
	// 	return this.intersectsSphere( _sphere );
	// }

	intersectsSphere( sphere ) {
		const planes = this.planes;
		const center = sphere.center;
		const negRadius = - sphere.radius;
		for ( let i = 0; i < 6; i ++ ) {
			const distance = planes[ i ].distanceToPoint( center );
			if ( distance < negRadius ) {
				return false;
			}
		}
		return true;
	}

	// intersectsBox( box ) {
	// 	const planes = this.planes;
	// 	for ( let i = 0; i < 6; i ++ ) {
	// 		const plane = planes[ i ];
	// 		// corner at max distance
	// 		_vector.x = plane.normal.x > 0 ? box.max.x : box.min.x;
	// 		_vector.y = plane.normal.y > 0 ? box.max.y : box.min.y;
	// 		_vector.z = plane.normal.z > 0 ? box.max.z : box.min.z;
	// 		if ( plane.distanceToPoint( _vector ) < 0 ) {
	// 			return false;
	// 		}
	// 	}
	// 	return true;
	// }

	containsPoint( point ) {
		const planes = this.planes;
		for ( let i = 0; i < 6; i ++ ) {
			if ( planes[ i ].distanceToPoint( point ) < 0 ) {
				return false;
			}
		}
		return true;
	}

	// clone() {
	// 	return new this.constructor().copyFrom( this );
	// }

}

export class FrustumProxy extends Frustum {
    [key: string]: any;

	constructor() {
		super();
		this.camPos = new Vector(0, 0, 0);
	}

	//
	setFromProjectionMatrix(matrix, camPos?) {
		this.camPos.copyFrom(camPos);
		return super.setFromProjectionMatrix(matrix);
	}

	containsPoint(point : Vector) {
		return super.containsPoint(point.sub(this.camPos).swapYZSelf());
	}

	//
	intersectsSphere(sphere : Sphere) {
		if(!sphere._temp) {
			sphere._temp = new Sphere(new Vector(0, 0, 0), sphere.radius);
		}
		sphere._temp.center.x = sphere.center.x - this.camPos.x;
		// !!!swapYZ
		sphere._temp.center.y = sphere.center.z - this.camPos.z;
		sphere._temp.center.z = sphere.center.y - this.camPos.y;
		return super.intersectsSphere(sphere._temp);
	}

	intersectsObjSphere(objPosition: Vector, sphere: Sphere) {
		if(!sphere._temp) {
			sphere._temp = new Sphere(new Vector(0, 0, 0), sphere.radius);
		}
		sphere._temp.center.x = sphere.center.x + (objPosition.x - this.camPos.x);
		// !!!swapYZ
		sphere._temp.center.y = sphere.center.z + (objPosition.z - this.camPos.z);
		sphere._temp.center.z = sphere.center.y + (objPosition.y - this.camPos.y);
		return super.intersectsSphere(sphere._temp);
	}

	//
	intersectsGeometryArray(geometry_array) : boolean {
		let in_frustum = false;
		for (let i = 0; i < geometry_array.length; i++) {
			let geom = geometry_array[i];
			if(geom instanceof Sphere) {
				if(this.intersectsSphere(geom)) {
					return true;
				}
			} else if(geom instanceof Vector) {
				if(this.containsPoint(geom)) {
					return true;
				}
			}
		}
		return in_frustum;
	}
}
