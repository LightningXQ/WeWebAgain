/* eslint-disable */
import React from 'react';
import {
	Box, 
} from '@mui/material';

const TestPage = () => {
	const pathcalc = (width, height, bezier) => {
		return `path('M0,${bezier} Q0,0 ${bezier},0 H${width-bezier} Q${width},0 ${width},${bezier} V${height-bezier} Q${width},${height} ${width-bezier},${height} H${bezier} Q0,${height} 0,${height-bezier} Z')`
	}

	return (
		<>
			{/* 1. Squircle 테스트 */}
			<>
				{/* <Box
					sx={{
						width: 200,
						height: 200,
						margin: 4,
						backgroundColor: 'dodgerblue',
						maskImage: 'url(/squircle-mask.svg)',
						WebkitMaskImage: 'url(/squircle-mask.svg)',

						maskSize: 'cover',
						WebkitMaskSize: 'cover',
						maskRepeat: 'no-repeat',
						WebkitMaskRepeat: 'no-repeat',
						maskPosition: 'center',
						WebkitMaskPosition: 'center',
						
						display: 'flex',
						justifyContent: 'center',
						alignItems: 'center',
						fontSize: 24, 
						color: "white",
					}}
				>
					Squircle
				</Box>
				<Box
					sx={{
						width: 200,
						height: 200,
						margin: 4,
						backgroundColor: 'coral',
						borderRadius: 12.45,
						
						display: 'flex',
						justifyContent: 'center',
						alignItems: 'center',
						fontSize: 24, 
						color: "white"
					}}
				>
					borderRadius
				</Box>
				<Box sx={{ position: 'relative', width: 200, height: 200, margin: 4 }}>
					<Box
						sx={{
							position: 'absolute',
							width: '100%',
							height: '100%',
							backgroundColor: 'white',
							maskImage: 'url(/squircle-mask.svg)',
							WebkitMaskImage: 'url(/squircle-mask.svg)',

							maskSize: 'cover',
							WebkitMaskSize: 'cover',
							maskRepeat: 'no-repeat',
							WebkitMaskRepeat: 'no-repeat',
							maskPosition: 'center',
							WebkitMaskPosition: 'center',

							zIndex: 2,
						}}
					>
					</Box>
					<Box
						sx={{
							position: 'absolute',
							width: '100%',
							height: '100%',
							backgroundColor: 'coral',
							borderRadius: 12.45,
							zIndex: 1,

							display: 'flex',
							justifyContent: 'center',
							alignItems: 'center',
							fontSize: 24, 
							color: "white"
						}}
					>
					</Box>
				</Box> */}
			</>
			
			{ /* 2. Squircle Fit 구현 */}
			<div style={{ minHeight: "100%", minWidth: "100%", overflow: "scroll" }}>
				<Box position="absolute"
					sx={{
						top: 0,
						left: 0,
						width: 200,
						height: 200,
						backgroundColor: 'dodgerblue',
						borderRadius: 12.45,

						textAlign: "center",
						alignContent: "center",
						fontSize: 24,
						color: "white",
					}}
				>
					round-square
				</Box>
				<Box position="absolute"
					sx={{
						top: 0,
						left: 300,
						width: 200,
						height: 200,
						backgroundColor: 'coral',
						maskImage: 'url(/apple.svg)',
						WebkitMaskImage: 'url(/apple.svg)',
						maskRepeat: 'no-repeat',
						WebkitMaskRepeat: 'no-repeat',
						maskSize: 'contain',
						WebkitMaskSize: 'contain',
						maskPosition: 'center',
						WebkitMaskPosition: 'center',

						textAlign: "center",
						alignContent: "center",
						fontSize: 24,
						color: "white",
					}}
				>
					Squircle	
				</Box>
				<Box position="absolute"
					sx={{
						top: 300,
						left: 0,
						width: 200,
						height: 200,
						backgroundColor: 'dodgerblue',
						borderRadius: 12.45,

						zIndex: 1,

						textAlign: "center",
						alignContent: "center",
						fontSize: 24,
						color: "white",
					}}
				>
					Overlap
				</Box>
				<Box position="absolute"
					sx={{
						top: 300,
						left: 0,
						width: 200,
						height: 200,
						backgroundColor: 'coral',
						maskImage: 'url(/apple.svg)',
						WebkitMaskImage: 'url(/apple.svg)',
						maskRepeat: 'no-repeat',
						WebkitMaskRepeat: 'no-repeat',
						maskSize: 'contain',
						WebkitMaskSize: 'contain',
						maskPosition: 'center',
						WebkitMaskPosition: 'center',

						opacity: 0.7, 
						zIndex: 2,

						textAlign: "center",
						alignContent: "center",
						fontSize: 24,
						color: "white",
					}}
				>
					Overlap
				</Box>
				<Box position="absolute"
					sx={{
						top: 300,
						left: 300,
						width: 200,
						height: 200,
						backgroundColor: 'dodgerblue',
						borderRadius: 12.45,
						zIndex: 1,
					}}
				/>	
				<Box position="absolute"
					sx={{
						top: 300,
						left: 300,
						width: 200,
						height: 200,
						backgroundColor: 'white',
						maskImage: 'url(/apple.svg)',
						WebkitMaskImage: 'url(/apple.svg)',

						maskRepeat: 'no-repeat',
						WebkitMaskRepeat: 'no-repeat',
						maskSize: 'contain',
						WebkitMaskSize: 'contain',
						maskPosition: 'center',
						WebkitMaskPosition: 'center',

						zIndex: 2,

						textAlign: "center",
						alignContent: "center",
						fontSize: 24,
					}}
				>
					Diff
				</Box>
				<Box position="absolute"
					sx={{
						top: 600,
						left: 0,
						width: 100,
						height: 100,
						backgroundColor: 'coral',
						maskImage: 'url(/apple.svg)',
						WebkitMaskImage: 'url(/apple.svg)',
						maskRepeat: 'no-repeat',
						WebkitMaskRepeat: 'no-repeat',
						maskSize: 'contain',
						WebkitMaskSize: 'contain',
						maskPosition: 'center',
						WebkitMaskPosition: 'center',

						zIndex: 2, 
						opacity: 0.7,
					}}
				/>
				<Box position="absolute"
					sx={{
						top: 600,
						left: 0,
						width: 200,
						height: 200,
						backgroundColor: 'dodgerblue',
						
						maskImage: 'url(/apple.svg)',
						WebkitMaskImage: 'url(/apple.svg)',
						maskRepeat: 'no-repeat',
						WebkitMaskRepeat: 'no-repeat',
						maskSize: 'contain',
						WebkitMaskSize: 'contain',
						maskPosition: 'center',
						WebkitMaskPosition: 'center',

						zIndex: 1, 

						textAlign: "center",
						alignContent: "center",
						fontSize: 24,
						color: "white",
					}}
				>
					Not Fit
				</Box>
				<Box position="absolute"
					sx={{
						top: 600,
						left: 300,
						width: 100,
						height: 100,
						backgroundColor: 'coral',
						maskImage: 'url(/apple.svg)',
						WebkitMaskImage: 'url(/apple.svg)',
						maskRepeat: 'no-repeat',
						WebkitMaskRepeat: 'no-repeat',
						maskSize: 'contain',
						WebkitMaskSize: 'contain',
						maskPosition: 'center',
						WebkitMaskPosition: 'center',
						zIndex: 2, 

						opacity: 0.7,
					}}
				/>
				<Box position="absolute"
					sx={ theme => ({
						top: 600,
						left: 300,
						width: 200,
						height: 200,
						backgroundColor: 'dodgerblue',
						// backgroundColor: 'white',
						clipPath: pathcalc(200, 200, 29),

						zIndex: 1, 

						textAlign: "center",
						alignContent: "center",
						fontSize: 24,
						color: "white",
					})}
				>
					Fit
				</Box>
				


				<Box position="absolute"
					sx={{
						top: 900,
						left: 0,
						width: 200,
						height: 200,
						backgroundColor: 'dodgerblue',
						borderRadius: 12.45,

						textAlign: "center",
						alignContent: "center",
						fontSize: 24,
						color: "white",
					}}
				>
					
				</Box>
				<Box position="absolute"
					sx={{
						top: 900,
						left: 300,
						width: 200,
						height: 200,
						backgroundColor: 'dodgerblue',
						borderRadius: 12.45,

						textAlign: "center",
						alignContent: "center",
						fontSize: 24,
						color: "white",
					}}
				>
					
				</Box>
				<Box position="absolute"
					sx={{
						top: 1200,
						left: 0,
						width: 200,
						height: 200,
						backgroundColor: 'dodgerblue',
						maskImage: 'url(/apple.svg)',
						WebkitMaskImage: 'url(/apple.svg)',
						maskRepeat: 'no-repeat',
						WebkitMaskRepeat: 'no-repeat',
						maskSize: 'contain',
						WebkitMaskSize: 'contain',
						maskPosition: 'center',
						WebkitMaskPosition: 'center',

						textAlign: "center",
						alignContent: "center",
						fontSize: 24,
						color: "white",
					}}
				>
				</Box>
				<Box position="absolute"
					sx={{
						top: 1200,
						left: 300,
						width: 200,
						height: 200,
						backgroundColor: 'dodgerblue',
						borderRadius: 12.45,

						textAlign: "center",
						alignContent: "center",
						fontSize: 24,
						color: "white",
					}}
				>
				</Box>
			</div>
		</>
	)
}

export default TestPage;
