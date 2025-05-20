import { getAddressDecoder } from "@solana/addresses";
import { fixDecoderSize, FixedSizeDecoder, getArrayDecoder, getBytesDecoder, getStructDecoder, getU128Decoder, getU64Decoder, getU8Decoder, ReadonlyUint8Array } from "@solana/codecs";

export interface RewardInfo {
    anchorDiscriminator: ReadonlyUint8Array;
    rewardState: number
    openTime: bigint
    endTime: bigint
    lastUpdateTime: bigint
    emissionsPerSecondX64: bigint
    rewardTotalEmissioned: bigint
    rewardClaimed: bigint
    tokenMint: string
    tokenVault: string
    authority: string
    rewardGrowthGlobalX64: bigint
}

export const RewardInfo: FixedSizeDecoder<RewardInfo> = getStructDecoder([
    ["anchorDiscriminator", fixDecoderSize(getBytesDecoder(), 8)],
    ['rewardState', getU8Decoder()],
    ['openTime', getU64Decoder()],
    ['endTime', getU64Decoder()],
    ['lastUpdateTime', getU64Decoder()],
    ['emissionsPerSecondX64', getU128Decoder()],
    ['rewardTotalEmissioned', getU64Decoder()],
    ['rewardClaimed', getU64Decoder()],
    ['tokenMint', getAddressDecoder()],
    ['tokenVault', getAddressDecoder()],
    ['authority', getAddressDecoder()],
    ['rewardGrowthGlobalX64', getU128Decoder()],
])

export interface PoolState {
    anchorDiscriminator: ReadonlyUint8Array;
    bump: Array<number>
    ammConfig: string
    owner: string
    tokenMint0: string
    tokenMint1: string
    // tokenVault0: string
    // tokenVault1: string
    // observationKey: string
    // mintDecimals0: number
    // mintDecimals1: number
    // tickSpacing: number
    // liquidity: bigint
    // sqrtPriceX64: bigint
    // tickCurrent: number
    // padding3: number
    // padding4: number
    // feeGrowthGlobal0X64: bigint
    // feeGrowthGlobal1X64: bigint
    // protocolFeesToken0: bigint
    // protocolFeesToken1: bigint
    // swapInAmountToken0: bigint
    // swapOutAmountToken1: bigint
    // swapInAmountToken1: bigint
    // swapOutAmountToken0: bigint
    // status: number
    // padding: Array<number>
    // rewardInfos: Array<RewardInfo>
    // tickArrayBitmap: Array<bigint>
    // totalFeesToken0: bigint
    // totalFeesClaimedToken0: bigint
    // totalFeesToken1: bigint
    // totalFeesClaimedToken1: bigint
    // fundFeesToken0: bigint
    // fundFeesToken1: bigint
    // openTime: bigint
    // recentEpoch: bigint
    // padding1: Array<bigint>
    // padding2: Array<bigint>
}

export const PoolState: FixedSizeDecoder<PoolState> = getStructDecoder([
    ["anchorDiscriminator", fixDecoderSize(getBytesDecoder(), 8)],
    ['bump', getArrayDecoder(getU8Decoder(), { size: 1 })],
    ['ammConfig', getAddressDecoder()],
    ['owner', getAddressDecoder()],
    ['tokenMint0', getAddressDecoder()],
    ['tokenMint1', getAddressDecoder()],
    // ['tokenVault0', getAddressDecoder()],
    // ['tokenVault1', getAddressDecoder()],
    // ['observationKey', getAddressDecoder()],
    // ['mintDecimals0', getU8Decoder()],
    // ['mintDecimals1', getU8Decoder()],
    // ['tickSpacing', getU16Decoder()],
    // ['liquidity', getU128Decoder()],
    // ['sqrtPriceX64', getU128Decoder()],
    // ['tickCurrent', getI32Decoder()],
    // ['padding3', getU16Decoder()],
    // ['padding4', getU16Decoder()],
    // ['feeGrowthGlobal0X64', getU128Decoder()],
    // ['feeGrowthGlobal1X64', getU128Decoder()],
    // ['protocolFeesToken0', getU64Decoder()],
    // ['protocolFeesToken1', getU64Decoder()],
    // ['swapInAmountToken0', getU128Decoder()],
    // ['swapOutAmountToken1', getU128Decoder()],
    // ['swapInAmountToken1', getU128Decoder()],
    // ['swapOutAmountToken0', getU128Decoder()],
    // ['status', getU8Decoder()],
    // ['padding', getArrayDecoder(getU8Decoder(), { size: 7 })],
    // ['rewardInfos', getArrayDecoder(RewardInfo, { size: 3 })],
    // ['tickArrayBitmap', getArrayDecoder(getU64Decoder(), { size: 16 })],
    // ['totalFeesToken0', getU64Decoder()],
    // ['totalFeesClaimedToken0', getU64Decoder()],
    // ['totalFeesToken1', getU64Decoder()],
    // ['totalFeesClaimedToken1', getU64Decoder()],
    // ['fundFeesToken0', getU64Decoder()],
    // ['fundFeesToken1', getU64Decoder()],
    // ['openTime', getU64Decoder()],
    // ['recentEpoch', getU64Decoder()],
    // ['padding1', getArrayDecoder(getU64Decoder(), { size: 24 })],
    // ['padding2', getArrayDecoder(getU64Decoder(), { size: 32 })],
]);