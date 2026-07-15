// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

interface IScheduler {
    function schedule(
        address target,
        bytes calldata callData,
        uint256 frequency,
        bytes calldata conditionCall,
        uint256 feeLimit
    ) external payable returns (uint256 scheduleId);

    function cancel(uint256 scheduleId) external;
}

contract VastMintScheduler {
    address constant SCHEDULER = 0x56e776BAE2DD60664b69Bd5F865F1180ffB7D58B;

    address public systemTxAccount;
    address public owner;
    address public marketplace;

    mapping(address => uint256) public mintPhaseScheduleId;
    mapping(uint256 => uint256) public listingExpiryScheduleId;
    mapping(address => bool) public isPublicMintOpen;

    event MintPhaseScheduled(address indexed collection, uint256 scheduleId);
    event MintPhaseTransitioned(address indexed collection);
    event ListingExpiryScheduled(uint256 indexed listingId, uint256 scheduleId);
    event ListingExpired(uint256 indexed listingId);

    modifier onlyScheduler() {
        require(msg.sender == systemTxAccount, "only Scheduler system tx");
        _;
    }

    modifier onlyOwner() {
        require(msg.sender == owner, "only owner");
        _;
    }

    constructor(address _systemTxAccount) {
        owner = msg.sender;
        systemTxAccount = _systemTxAccount;
    }

    function setSystemTxAccount(address _systemTxAccount) external onlyOwner {
        systemTxAccount = _systemTxAccount;
    }

    function setMarketplace(address _marketplace) external onlyOwner {
        marketplace = _marketplace;
    }

    function scheduleMintPhaseTransition(address collection) external payable {
        bytes memory callData = abi.encodeWithSelector(this.transitionToPublicMint.selector, collection);
        uint256 scheduleId = IScheduler(SCHEDULER).schedule{value: msg.value}(
            address(this), callData, 0, "", msg.value
        );
        mintPhaseScheduleId[collection] = scheduleId;
        emit MintPhaseScheduled(collection, scheduleId);
    }

    function transitionToPublicMint(address collection) external onlyScheduler {
        isPublicMintOpen[collection] = true;
        emit MintPhaseTransitioned(collection);
    }

    function scheduleListingExpiry(uint256 listingId) external payable {
        bytes memory callData = abi.encodeWithSelector(this.expireListing.selector, listingId);
        uint256 scheduleId = IScheduler(SCHEDULER).schedule{value: msg.value}(
            address(this), callData, 0, "", msg.value
        );
        listingExpiryScheduleId[listingId] = scheduleId;
        emit ListingExpiryScheduled(listingId, scheduleId);
    }

    function expireListing(uint256 listingId) external onlyScheduler {
        (bool ok, ) = marketplace.call(
            abi.encodeWithSignature("cancelExpiredListing(uint256)", listingId)
        );
        require(ok, "cancelExpiredListing failed");
        emit ListingExpired(listingId);
    }

    function cancelSchedule(uint256 scheduleId) external onlyOwner {
        IScheduler(SCHEDULER).cancel(scheduleId);
    }
}