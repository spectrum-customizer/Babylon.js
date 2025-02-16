import type { IGLTFExporterExtensionV2 } from "../glTFExporterExtension";
import { GLTFExporter } from "../glTFExporter";
import type { BufferManager } from "../bufferManager";
import type { IMeshPrimitive, IAccessor, INode, IKHRMaterialVariants_Variant, IKHRMaterialVariants_Variants } from "babylonjs-gltf2interface";
import type { Nullable } from "core/types";
import type { Node } from "core/node";

/** name of the extension */
const NAME = "KHR_materials_variants";

/**
 * @internal
 */
// eslint-disable-next-line @typescript-eslint/naming-convention
export class KHR_materials_variants implements IGLTFExporterExtensionV2 {
    /** Name of this extension */
    public readonly name = NAME;

    /** Defines whether this extension is enabled */
    public enabled = true;

    /** Defines whether this extension is required */
    public required = false;

    /** Reference to the glTF exporter */
    private _wasUsed = false;

    /** an array of material variants */
    private _variants: IKHRMaterialVariants_Variant[] = [];

    private _exporter: GLTFExporter;

    constructor(exporter: GLTFExporter) {
        this._exporter = exporter;
    }

    public dispose() {}

    public postExportMeshPrimitive?(primitive: IMeshPrimitive, bufferManager: BufferManager, accessors: IAccessor[]): void {
        this._wasUsed = true;
    }

    public postExportNodeAsync(
        context: string,
        node: Nullable<INode>,
        babylonNode: Node,
        nodeMap: Map<Node, number>,
        convertToRightHanded: boolean,
        bufferManager: BufferManager
    ): Promise<Nullable<INode>> {
        return new Promise((resolve) => {
            if (!this._wasUsed) {
                resolve(node);
                return;
            }

            const gltf = this._exporter._glTF;

            // Add to extensionsUsed if not already present
            if (!gltf.extensionsUsed) {
                gltf.extensionsUsed = [];
            }

            // add name of extension to property
            if (!gltf.extensionsUsed.includes(NAME)) {
                gltf.extensionsUsed.push(NAME);
            }

            // add extensions attribute if it does not exist
            if (!gltf.extensions) {
                gltf.extensions = {};
            }

            // add all the variants to the root node
            // the data in the gltf should look like this:
            // "extensions": {
            //     "KHR_materials_variants": {
            //       "variants": [
            //         {
            //           "name": "midnight"
            //         },
            //         {
            //           "name": "beach"
            //         },
            //         {
            //           "name": "street"
            //         }
            //       ]
            //     }
            //   },
            const variants: IKHRMaterialVariants_Variants = {
                variants: this._variants,
            };

            gltf.extensions[NAME] = variants;

            // gltf.extensions[NAME] = {
            //     variants: this._variants,
            // } as IKHRMaterialVariantsRoot;

            resolve(node);
        });
    }
    /** @internal */
    public get wasUsed() {
        return this._wasUsed;
    }
}

GLTFExporter.RegisterExtension(NAME, (exporter) => new KHR_materials_variants(exporter));
