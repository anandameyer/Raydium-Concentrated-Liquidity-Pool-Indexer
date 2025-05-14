// get from https://www.quicknode.com/guides/solana-development/tooling/web3-2/account-deserialization

import { Address } from "@coral-xyz/anchor";
import { getAddressDecoder } from "@solana/addresses";
import { fixDecoderSize, FixedSizeDecoder, getArrayDecoder, getBytesDecoder, getStructDecoder, getU16Decoder, getU32Decoder, getU64Decoder, getU8Decoder, ReadonlyUint8Array } from "@solana/codecs";

export interface AmmConfig {
    anchorDiscriminator: ReadonlyUint8Array;
    bump: number;
    index: number;
    owner: Address;
    protocolFeeRate: number;
    tradeFeeRate: number;
    tickSpacing: number;
    fundFeeRate: number;
    paddingU32: number;
    fundOwner: Address;
    padding: bigint[];
}

export const ammConfigDecoder: FixedSizeDecoder<AmmConfig> =
    getStructDecoder([
        ["anchorDiscriminator", fixDecoderSize(getBytesDecoder(), 8)],
        ["bump", getU8Decoder()],
        ["index", getU16Decoder()],
        ["owner", getAddressDecoder()],
        ["protocolFeeRate", getU32Decoder()],
        ["tradeFeeRate", getU32Decoder()],
        ["tickSpacing", getU16Decoder()],
        ["fundFeeRate", getU32Decoder()],
        ["paddingU32", getU32Decoder()],
        ["fundOwner", getAddressDecoder()],
        ["padding", getArrayDecoder(
            getU64Decoder(),
            { size: 3 }
        )]
    ]);

// export const AmmConfig = struct({
//     bump: u8,
//     index: u16,
//     owner: address,
//     protocolFeeRate: u32,
//     tradeFeeRate: u32,
//     tickSpacing: u16,
//     fundFeeRate: u32,
//     paddingU32: u32,
//     fundOwner: address,
//     padding: fixedArray(u64, 3),
// })