// Exact selector/metric excerpt from acquired common-human-default-1-fragment.wgsl
// Source tmp/test-runs/shared-metadata-integer-binding-ghost-contract-2026-11-04T13-28-41.223Z-14652/artifacts/common-human-default-1-fragment.wgsl
// SHA256 0255c0d400717c50b9cb54856ac9e2b6f8f901a506c279c0b609609d09ce5227
// Original first line 1039. Wrapper/declarations only; not a standalone GPU program.
var<private> nodeVar1283 : vec4<f32>;
var<private> nodeVar1284 : vec2<f32>;
var<private> nodeVar1285 : vec2<f32>;
var<private> nodeVar1286 : vec3<f32>;
var<private> nodeVar1287 : vec3<f32>;
var<private> nodeVar1288 : f32;
var<private> nodeVar1289 : f32;
var<private> nodeVar1290 : f32;
var<private> nodeVar1291 : f32;
var<private> nodeVar1292 : vec3<f32>;
var<private> nodeVar1293 : vec3<f32>;
var<private> nodeVar1294 : f32;
var<private> nodeVar1295 : vec3<f32>;
var<private> nodeVar1296 : f32;
var<private> nodeVar1297 : f32;
var<private> nodeVar1298 : vec3<f32>;
var<private> nodeVar1299 : vec3<f32>;
var<private> nodeVar1300 : vec2<f32>;
var<private> nodeVar1303 : vec4<f32>;
var<private> nodeVar1304 : vec2<f32>;
var<private> nodeVar1305 : vec4<f32>;
var<private> nodeVar1306 : vec4<f32>;
var<private> nodeVar1307 : vec4<f32>;
var<private> nodeVar1308 : vec4<f32>;
var<private> nodeVar1309 : vec4<f32>;
var<private> nodeVar1310 : vec4<f32>;
var<private> nodeVar1311 : vec4<f32>;
var<private> nodeVar1312 : vec4<f32>;
fn main() {
if ( ( object.nodeUniform17 == 1.0 ) ) {

			nodeVar1284 = dpdx( v_pawnSurfaceUv );
			nodeVar1285 = - dpdy( v_pawnSurfaceUv );
			nodeVar1286 = dpdx( v_positionView );
			nodeVar1287 = - dpdy( v_positionView );
			nodeVar1288 = ( ( nodeVar1284.x * nodeVar1285.y ) - ( nodeVar1284.y * nodeVar1285.x ) );
			nodeVar1289 = max( ( ( length( nodeVar1284 ) * length( nodeVar1285 ) ) * 1e-7 ), 1e-30 );

			if ( ( nodeVar1288 < 0.0 ) ) {

				nodeVar1290 = -1.0;

			} else {

				nodeVar1290 = 1.0;

			}

			nodeVar1291 = ( max( abs( nodeVar1288 ), nodeVar1289 ) * nodeVar1290 );
			nodeVar1292 = ( ( ( nodeVar1286 * vec3<f32>( nodeVar1285.y ) ) - ( nodeVar1287 * vec3<f32>( nodeVar1284.y ) ) ) / vec3<f32>( nodeVar1291 ) );
			nodeVar1293 = ( ( ( nodeVar1287 * vec3<f32>( nodeVar1284.x ) ) - ( nodeVar1286 * vec3<f32>( nodeVar1285.x ) ) ) / vec3<f32>( nodeVar1291 ) );
			nodeVar1294 = length( nodeVar1292 );
			nodeVar1295 = ( nodeVar1292 / vec3<f32>( max( nodeVar1294, 1e-10 ) ) );
			nodeVar1296 = dot( nodeVar1295, nodeVar1293 );
			nodeVar1297 = length( ( nodeVar1293 - ( nodeVar1295 * vec3<f32>( nodeVar1296 ) ) ) );

			if ( ( ( ( abs( nodeVar1288 ) > nodeVar1289 ) && ( nodeVar1294 > 1e-10 ) ) && ( nodeVar1297 > 1e-10 ) ) ) {

				nodeVar1298 = vec3<f32>( min( nodeVar1294, 1000000.0 ), clamp( nodeVar1296, -1000000.0, 1000000.0 ), min( nodeVar1297, 1000000.0 ) );

			} else {

				nodeVar1298 = vec3<f32>( 1.0, 0.0, 1.0 );

			}

			nodeVar1299 = nodeVar1298;
			nodeVar1300 = ( vec2<f32>( ( ( v_pawnSurfaceUv.x * nodeVar1299.x ) + ( v_pawnSurfaceUv.y * nodeVar1299.y ) ), ( v_pawnSurfaceUv.y * nodeVar1299.z ) ) * vec2<f32>( ( 1.0 / sqrt( max( ( nodeVar1299.x * nodeVar1299.z ), 1e-20 ) ) ) ) );
			nodeVar1303 = textureSample( nodeUniform18, nodeUniform18_sampler, nodeVar1300, i32( nodeVarying8.x ) );
			nodeVar1283 = nodeVar1303;
			

		} else {


			if ( ( ( ( object.nodeUniform17 > 0.0 ) && ( nodeVarying8.x >= 0.0 ) ) && ( nodeVarying8.x < 256.0 ) ) ) {

				nodeVar1299 = nodeVar1298;
				nodeVar1299 = nodeVar1298;
				nodeVar1299 = nodeVar1298;
				nodeVar1299 = nodeVar1298;
				nodeVar1299 = nodeVar1298;
				nodeVar1304 = ( vec2<f32>( ( ( v_pawnSurfaceUv.x * nodeVar1299.x ) + ( v_pawnSurfaceUv.y * nodeVar1299.y ) ), ( v_pawnSurfaceUv.y * nodeVar1299.z ) ) * vec2<f32>( ( 1.0 / sqrt( max( ( nodeVar1299.x * nodeVar1299.z ), 1e-20 ) ) ) ) );
				nodeVar1305 = textureSample( nodeUniform18, nodeUniform18_sampler, nodeVar1304, i32( tsl_mod_float( nodeVarying8.x, 256.0 ) ) );
				nodeVar1283 = nodeVar1305;
				

			}


			if ( ( ( ( object.nodeUniform17 > 1.0 ) && ( nodeVarying8.x >= 256.0 ) ) && ( nodeVarying8.x < 512.0 ) ) ) {

				nodeVar1306 = textureSample( nodeUniform21, nodeUniform21_sampler, nodeVar1304, i32( tsl_mod_float( nodeVarying8.x, 256.0 ) ) );
				nodeVar1283 = nodeVar1306;
				

			}


			if ( ( ( ( object.nodeUniform17 > 2.0 ) && ( nodeVarying8.x >= 512.0 ) ) && ( nodeVarying8.x < 768.0 ) ) ) {

				nodeVar1307 = textureSample( nodeUniform22, nodeUniform22_sampler, nodeVar1304, i32( tsl_mod_float( nodeVarying8.x, 256.0 ) ) );
				nodeVar1283 = nodeVar1307;
				

			}


			if ( ( ( ( object.nodeUniform17 > 3.0 ) && ( nodeVarying8.x >= 768.0 ) ) && ( nodeVarying8.x < 1024.0 ) ) ) {

				nodeVar1308 = textureSample( nodeUniform23, nodeUniform23_sampler, nodeVar1304, i32( tsl_mod_float( nodeVarying8.x, 256.0 ) ) );
				nodeVar1283 = nodeVar1308;
				

			}


			if ( ( ( ( object.nodeUniform17 > 4.0 ) && ( nodeVarying8.x >= 1024.0 ) ) && ( nodeVarying8.x < 1280.0 ) ) ) {

				nodeVar1309 = textureSample( nodeUniform24, nodeUniform24_sampler, nodeVar1304, i32( tsl_mod_float( nodeVarying8.x, 256.0 ) ) );
				nodeVar1283 = nodeVar1309;
				

			}


			if ( ( ( ( object.nodeUniform17 > 5.0 ) && ( nodeVarying8.x >= 1280.0 ) ) && ( nodeVarying8.x < 1536.0 ) ) ) {

				nodeVar1310 = textureSample( nodeUniform25, nodeUniform25_sampler, nodeVar1304, i32( tsl_mod_float( nodeVarying8.x, 256.0 ) ) );
				nodeVar1283 = nodeVar1310;
				

			}


			if ( ( ( ( object.nodeUniform17 > 6.0 ) && ( nodeVarying8.x >= 1536.0 ) ) && ( nodeVarying8.x < 1792.0 ) ) ) {

				nodeVar1311 = textureSample( nodeUniform26, nodeUniform26_sampler, nodeVar1304, i32( tsl_mod_float( nodeVarying8.x, 256.0 ) ) );
				nodeVar1283 = nodeVar1311;
				

			}


			if ( ( ( ( object.nodeUniform17 > 7.0 ) && ( nodeVarying8.x >= 1792.0 ) ) && ( nodeVarying8.x < 2048.0 ) ) ) {

				nodeVar1312 = textureSample( nodeUniform27, nodeUniform27_sampler, nodeVar1304, i32( tsl_mod_float( nodeVarying8.x, 256.0 ) ) );
				nodeVar1283 = nodeVar1312;
				

			}

			

		}
}
