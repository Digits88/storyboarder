import React, { useState, useCallback, useRef, useEffect, useMemo, useLayoutEffect } from 'react'
import ShotMaker from './ShotMaker'
import { Provider, connect} from 'react-redux'
import { Canvas } from 'react-three-fiber'
import { useThree, useFrame } from 'react-three-fiber'
import ShotExplorerSceneManager from './ShotExplorerSceneManager'
import FatalErrorBoundary from '../shot-generator/components/FatalErrorBoundary'
import {OutlineEffect} from '../vendor/OutlineEffect'
import {useAsset, cleanUpCache, cache} from '../shot-generator/hooks/use-assets-manager'
import TWEEN from '@tweenjs/tween.js'

const Effect = ({}) => {
    const {gl, size} = useThree()
  
    const outlineEffect = new OutlineEffect(gl, { defaultThickness: 0.015 })
    
    useEffect(() => void outlineEffect.setSize(size.width, size.height), [size])
    useFrame(({ gl, scene, camera }, time) => {
        TWEEN.update()
        outlineEffect.render(scene, camera)
    }, 1)
    
    return null
  }

  
const ShotExplorer = React.memo(({
    withState,
    aspectRatio,
    store,
}) => {
    const [sceneInfo, setSceneInfo] = useState(null)
    const [newAssetsLoaded, setLoadedAssets] = useState()
    const setLargeCanvasData = (camera, scene, gl) => {
        setSceneInfo({camera, scene, gl})
    }

    const updateAssets = () => {setLoadedAssets({})}

    useEffect(() => {
        cache.subscribe(updateAssets)
        return () => {
            cache.unsubscribe(updateAssets)
        }
    }, [])
    
    return (
    <FatalErrorBoundary>
        <Canvas
            tabIndex={ 1 }
            key="camera-canvas"
            id="camera-canvas"
            gl2={true}
            updateDefaultCamera={ true }
            noEvents={ true }
            className="shot-explorer-shot-selected" 
            style={{ width: (900 * aspectRatio) / 2, height: 900 / 2 }}>
            <Provider store={store}>
                <ShotExplorerSceneManager
                            setLargeCanvasData= { setLargeCanvasData }
                            isPreview={ true }/>
            </Provider>
            <Effect />
        </Canvas>
        <ShotMaker sceneInfo={ sceneInfo } 
                    withState={ withState }
                    aspectRatio={ aspectRatio }
                    newAssetsLoaded={ newAssetsLoaded } /> 
    </FatalErrorBoundary>
    )
})

const withState = (fn) => (dispatch, getState) => fn(dispatch, getState())
export default connect(
(state) => ({
    mainViewCamera: state.mainViewCamera,
    aspectRatio: state.aspectRatio
}), 
{
    withState
})
(ShotExplorer)