const {IK, IKJoint}  = require("../../../../shot-generator/IK/core/three-ik");
const THREE = require( "three");
const {setZDirecion, setReverseZ} = require( "../../../../shot-generator/IK/utils/axisUtils");
const ChainObject = require( "../../../../shot-generator/IK/objects/IkObjects/ChainObject");
const SkeletonUtils = require("../../../../shot-generator/IK/utils/SkeletonUtils");
const XRIKSwitcher = require("./XrIKSwitcher");
require("../../../../shot-generator/IK/utils/Object3dExtension");

class XrIkObject
{
    constructor()
    {
        if(new.target === XrIkObject)
        {
            throw new TypeError("Cannot construct abstract IkObject directly");
        }
        this.ikSwitcher = null;
        this.isEnabledIk = false;
        this.clonedObject = null;
        this.controlTargets = [];
        this.originalObject = null;
        this.applyingOffset = false;
        this.isRotation = false;
        this.scene = null;  
        this.hipsMouseDown = false;
    }

    //#region External Methods
    // Take ns skeleton and target for it's limbs
    initObject(scene, objectSkeleton, controlTargets)
    {
        this.ik = new IK();
        this.scene = scene;
        let chains = [];
        let clonedSkeleton = SkeletonUtils.clone(objectSkeleton);
        this.clonedObject = clonedSkeleton;
        this.originalObject = objectSkeleton;
        this.ikSwitcher = new XRIKSwitcher(objectSkeleton, clonedSkeleton);
        this.rigMesh = clonedSkeleton.getObjectByProperty("type", "SkinnedMesh");
        this.originalMesh = objectSkeleton.getObjectByProperty("type", "SkinnedMesh");
        let rigMesh = this.rigMesh;
        let chainObjects = {};
        this.chainObjects = chainObjects;
        this.controlTargets = controlTargets;

        this.hipsControlTarget = controlTargets[0];
        controlTargets[0].name = "Hips";
        chainObjects["Head"] = new ChainObject("Spine", "Head", controlTargets[1]);
        chainObjects['LeftHand'] = new ChainObject("LeftArm", "LeftHand", controlTargets[2]);
        chainObjects['RightHand'] = new ChainObject("RightArm", "RightHand", controlTargets[3]);
        chainObjects['LeftFoot'] = new ChainObject("LeftUpLeg", "LeftFoot", controlTargets[4]);
        chainObjects['RightFoot'] = new ChainObject("RightUpLeg", "RightFoot", controlTargets[5]);

        //Fixing female-adult spine deformation
        if(rigMesh.name === "female-adult-meso")
        {
            rigMesh.skeleton.bones[2].rotation.set(0, 0, 0);
            rigMesh.skeleton.bones[2].updateMatrix();
            rigMesh.skeleton.bones[2].updateMatrixWorld(true, true);
        }
        initializeChainObject(this, chains);
        this.ikSwitcher.ikBonesName.push("Hips");
        // Goes through list of constraints and adds it to IK
        chains.forEach((chain) =>
        {
            this.ik.add(chain);
        });
        // Adds skeleton helper to scene
        this.ikSwitcher.recalculateDifference();
        this.ikSwitcher.calculateRelativeAngle();
    }

    get chainObjectsValues()
    {
        return Object.values(this.chainObjects);
    }

    // Updates chains
    // Only done this left limbs in order to see difference
    update()
    {
        if(this.isEnabledIk)
        {
            if(!this.isRotation)
            {
                let target = this.getTargetForSolve();
                // Solves the inverse kinematic of object
                this.ik.solve(target);
            }
            this.lateUpdate();
            if(IK.firstRun)
            {
                this.ikSwitcher.recalculateDifference();
            }
        }
    }

    // Updates which is called last after all stuff in loop has been done
    // Fires after ik solver in order to apply custom changes to models
    // Ik solver overrides all changes if applied before it's fired
    lateUpdate()
    {
        let hipsTarget = this.hipsControlTarget;
        // Sets back position when offset is not changing
        // When we are changing back position offset between hips and back shouldn't be applied
        if(!this.applyingOffset && this.hipsMouseDown)
        {
            let backTarget = this.chainObjects["Head"].controlTarget;

            let hipsPosition = hipsTarget.position.clone();
            hipsTarget.parent.localToWorld(hipsPosition);
            backTarget.parent.worldToLocal(hipsPosition);
            let result = hipsPosition.add(this.backOffset);
            backTarget.position.copy(result);
        }
    }

    //#endregion

    //#region Internal methods
    getTargetForSolve()
    {
        let controlTargets = this.controlTargets;
        for(let i = 1; i < controlTargets.length; i++)
        {
            let target = controlTargets[i];
            if(target.isActivated === true)
            {
                return target;
            }
        }
        return null;
    }

    // Resets targets position
    // After IK has been turned off and on
    resetTargets()
    {
        this.calculteBackOffset();
    }

    // Calculates back's offset in order to move with hips
    calculteBackOffset()
    {
        let backPosition = this.chainObjects["Head"].controlTarget.position.clone();
        let hipsPosition = this.hipsControlTarget.position.clone();
        this.backOffset = backPosition.sub(hipsPosition);
    }
    //#endregion
}

const initializeChainObject = (ikObject, chains) =>
{
    // Goes through all scene objects
    ikObject.clonedObject.traverse((object) =>
    {
        // Searches only bones object
        if(object instanceof THREE.Bone)
        {
            object.matrixAutoUpdate = false;
            object.matrixWorldNeedsUpdate = false;
            // Flips a model's forward from -Z to +Z
            // By default Models axis is -Z while Three ik works with +Z
            if(object.name === "Hips")
            {
                ikObject.hips = object;
                setZDirecion(object, new THREE.Vector3(0, 0, 1));
            }
            // Goes through all chain objects to find with which we are working
            ikObject.chainObjectsValues.forEach((chainObject) =>
            {
                // Finds base Object Name or an object from which chain starting
                // Also checks if chain is started
                if(object.name == chainObject.baseObjectName || chainObject.isChainObjectStarted)
                { 
                    let chain = chainObject.chain;
                    // Checks if root object
                    if(object.name === chainObject.baseObjectName)
                    {
                        chainObject.isChainObjectStarted = true;
                        chains.push(chain);
                    }
                    // Declares target
                    // Target(Effector) is object to which chain is trying to get
                    let target =  null;
                    // Checks if object is last
                    if(object.name === chainObject.lastObjectName)
                    {
                        target = chainObject.controlTarget;
                        target.name = object.name;
                        chainObject.isChainObjectStarted = false;
                    }
                    ikObject.ikSwitcher.ikBonesName.push(object.name);
                    // Creates joint by passing current bone and its constraint
                    let joint = new IKJoint(object, {});
                    // Adds joint to chain and sets target
                    chain.add(joint, {target});
                }
            });
        }
    });
}

module.exports =  XrIkObject;
