import type { IGLTFExporterExtensionV2 } from "../glTFExporterExtension";
import { GLTFExporter } from "../glTFExporter";
import type { BufferManager } from "../bufferManager";
import type { INode, IKHRMaterialVariants_Variant, IKHRMaterialVariants_Variants, IMeshPrimitive, IAccessor, IKHRMaterialVariants_Mapping } from "babylonjs-gltf2interface";
import { ImageMimeType } from "babylonjs-gltf2interface";
import type { Nullable } from "core/types";
import type { Node } from "core/node";
import type { PBRBaseMaterial } from "core/Materials/PBR/pbrBaseMaterial";
import type { AbstractMesh } from "core/Meshes/abstractMesh";

//import type { BaseTexture } from "core/Materials/Textures/baseTexture";
import type { Material } from "core/Materials/material";
// import { PBRMaterial } from "core/Materials/PBR/pbrMaterial";

/** name of the extension */
const NAME = "KHR_materials_variants";

interface IVariantsMap {
    [key: string]: Array<{ mesh: AbstractMesh; material: Nullable<Material> }>;
}

interface IExtensionMetadata {
    lastSelected: Nullable<string | Array<string>>;
    original: Array<{ mesh: AbstractMesh; material: Nullable<Material> }>;
    variants: IVariantsMap;
}
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
    private _variantIndexMap: Map<string, number> = new Map();

    private _exporter: GLTFExporter;

    private _rootNode: Nullable<Node>;

    constructor(exporter: GLTFExporter) {
        this._exporter = exporter;
    }

    public dispose() {}

    public postExportMeshPrimitive?(primitive: IMeshPrimitive, bufferManager: BufferManager, accessors: IAccessor[]): void {
        if (!this._rootNode) {
            return;
        }
        const metadata = this._rootNode._internalMetadata?.gltf?.[NAME] as IExtensionMetadata;
        if (!metadata) {
            return;
        }
        // Create mappings array for this primitive
        const mappings: IKHRMaterialVariants_Mapping["mappings"] = [];
        // For each variant
        for (const [variantName, entries] of Object.entries(metadata.variants)) {
            // For each material entry in this variant
            for (const entry of entries) {
                if (entry.material) {
                    const materialIndex = this._exporter._materialMap.get(entry.material);
                    const variantIndex = this._variantIndexMap.get(variantName);

                    if (materialIndex !== undefined && variantIndex !== undefined) {
                        mappings.push({
                            material: materialIndex,
                            variants: [variantIndex],
                        });
                    }
                }
            }
        }
        // Add the mappings to the primitive's extensions
        if (mappings.length > 0) {
            if (!primitive.extensions) {
                primitive.extensions = {};
            }
            primitive.extensions[NAME] = {
                mappings: mappings,
            };
            this._wasUsed = true;
        }
    }

    private _findRootNode(node: Node): Nullable<Node> {
        let current: Nullable<Node> = node;
        while (current) {
            if (current.name === "__root__") {
                return current;
            }
            current = current.parent;
        }
        return null;
    }

    private _exportMaterialAsync = async (babylonPBRMaterial: PBRBaseMaterial) => {
        const index = await this._exporter._materialExporter.exportPBRMaterialAsync(babylonPBRMaterial, ImageMimeType.PNG, true);
        return index;
    };

    // public postExportMaterialAdditionalTextures?(context: string, node: IMaterial, babylonMaterial: Material): BaseTexture[] {
    //     const additionalTextures: BaseTexture[] = [];
    //     const rootNode = this._findRootNode(babylonMaterial.getScene().meshes[0]);
    //     if (!rootNode) {
    //         return additionalTextures;
    //     }
    //     const metadata = rootNode._internalMetadata?.gltf?.[NAME];
    //     if (!metadata) {
    //         return additionalTextures;
    //     }
    //     return additionalTextures;
    // }

    public postExportNodeAsync(
        context: string,
        node: Nullable<INode>,
        babylonNode: Node,
        nodeMap: Map<Node, number>,
        convertToRightHanded: boolean,
        bufferManager: BufferManager
    ): Promise<Nullable<INode>> {
        return new Promise((resolve) => {
            this._rootNode = this._findRootNode(babylonNode);
            if (!this._wasUsed) {
                if (this._rootNode) {
                    // We can now access metadata from rootNode._internalMetadata?.gltf?.[NAME]
                    const metadata = this._rootNode._internalMetadata?.gltf?.[NAME];
                    if (metadata) {
                        const gltf = this._exporter._glTF;
                        // Get variant names and populate our internal arrays
                        const variantNames = Object.keys(metadata.variants);
                        this._variants = variantNames.map((name, index) => {
                            this._variantIndexMap.set(name, index);
                            return { name };
                        });
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
                        // const variants: IKHRMaterialVariants_Variants = {
                        //     variants: this._variants,
                        // };
                        gltf.extensions[NAME] = {
                            variants: this._variants, // Was incorrectly assigning the array directly to the extension
                        } as IKHRMaterialVariants_Variants; // Using the proper interface
                        // Export all variant materials
                        for (const variantName of variantNames) {
                            const variantEntries = metadata.variants[variantName];
                            for (const entry of variantEntries) {
                                if (entry.material) {
                                    this._exportMaterialAsync(entry.material);
                                    // materialIndex = await this._exporter._materialExporter.exportPBRMaterialAsync(entry.material, ImageMimeType.PNG, true);
                                }
                            }
                        }
                        this._wasUsed = true;
                    }
                }
            }
            resolve(node);
        });
    }
    /** @internal */
    public get wasUsed() {
        return this._wasUsed;
    }
}

GLTFExporter.RegisterExtension(NAME, (exporter) => new KHR_materials_variants(exporter));
