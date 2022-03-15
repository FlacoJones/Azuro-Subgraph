import { BigInt, store } from "@graphprotocol/graph-ts"
import { DepositClaimed } from "../../generated/OpenQ/OpenQ"
import {
	TokenEvents,
	Payout,
	User,
	UserPayoutTokenBalance,
	OrganizationPayoutTokenBalance,
	OrganizationFundedTokenBalance,
	PayoutTokenBalance,
	Deposit
} from "../../generated/schema"

export default function handleDepositClaimed(event: DepositClaimed): void {
	// UPDATE DEPOSIT CLAIMED
	let deposit = Deposit.load(event.params.depositId.toHexString())

	if (!deposit) {
		throw "Error"
	}

	deposit.claimed = true;

	let bountyPayoutId = `${event.params.closer.toHexString()}-${event.params.bountyAddress.toHexString()}-${deposit.tokenAddress.toHexString()}-${event.params.payoutTime}`
	let payout = new Payout(bountyPayoutId)

	payout.tokenAddress = deposit.tokenAddress
	payout.bounty = event.params.bountyAddress.toHexString()
	payout.volume = deposit.volume
	payout.payoutTime = event.params.payoutTime
	payout.organization = event.params.organization
	payout.transactionHash = event.transaction.hash;

	// UPSERT USER
	let user = User.load(event.params.closer.toHexString())

	if (!user) {
		user = new User(event.params.closer.toHexString())
		user.save()
	}

	payout.closer = user.id

	// UPSERT TOKEN EVENTS
	let tokenEvents = TokenEvents.load(deposit.tokenAddress.toHexString())

	if (!tokenEvents) {
		tokenEvents = new TokenEvents(deposit.tokenAddress.toHexString())
		payout.tokenEvents = tokenEvents.id
	}

	// UPSERT USER PAYOUT TOKEN BALANCE
	const userPayoutTokenBalanceId = `${event.params.closer.toHexString()}-${deposit.tokenAddress.toHexString()}`
	let userPayoutTokenBalance = UserPayoutTokenBalance.load(userPayoutTokenBalanceId)

	if (!userPayoutTokenBalance) {
		userPayoutTokenBalance = new UserPayoutTokenBalance(userPayoutTokenBalanceId)
		userPayoutTokenBalance.user = event.params.closer.toHexString()
		userPayoutTokenBalance.tokenAddress = deposit.tokenAddress
	}

	userPayoutTokenBalance.volume = userPayoutTokenBalance.volume.plus(deposit.volume)

	// UPSERT ORGANIZATION PAYOUT TOKEN BALANCE
	const organizationPayoutTokenBalanceId = `${event.params.organization}-${deposit.tokenAddress.toHexString()}`
	let organizationPayoutTokenBalance = OrganizationPayoutTokenBalance.load(organizationPayoutTokenBalanceId)

	if (!organizationPayoutTokenBalance) {
		organizationPayoutTokenBalance = new OrganizationPayoutTokenBalance(organizationPayoutTokenBalanceId)
		organizationPayoutTokenBalance.organization = event.params.organization
		organizationPayoutTokenBalance.tokenAddress = deposit.tokenAddress
	}

	organizationPayoutTokenBalance.volume = organizationPayoutTokenBalance.volume.plus(deposit.volume)

	// UPDATE ORGANIZATION FUNDED TOKEN BALANCE
	const organizationFundedTokenBalanceId = `${event.params.organization}-${deposit.tokenAddress.toHexString()}`
	let organizationFundedTokenBalance = OrganizationFundedTokenBalance.load(organizationFundedTokenBalanceId)

	if (!organizationFundedTokenBalance) {
		throw "Error"
	}

	organizationFundedTokenBalance.volume = organizationFundedTokenBalance.volume.minus(deposit.volume)

	// UPSERT TOTAL FUNDED TOKEN BALANCE
	let payoutTokenBalance = PayoutTokenBalance.load(deposit.tokenAddress.toHexString())

	if (!payoutTokenBalance) {
		payoutTokenBalance = new PayoutTokenBalance(deposit.tokenAddress.toHexString())
	}

	payoutTokenBalance.volume = payoutTokenBalance.volume.plus(deposit.volume)

	// SAVE ALL ENTITIES
	payout.save()
	tokenEvents.save()
	userPayoutTokenBalance.save()
	payoutTokenBalance.save()
	deposit.save()
	organizationFundedTokenBalance.save()

	if (organizationFundedTokenBalance.volume.equals(new BigInt(0))) {
		store.remove('OrganizationFundedTokenBalance', organizationFundedTokenBalanceId)
	}
}