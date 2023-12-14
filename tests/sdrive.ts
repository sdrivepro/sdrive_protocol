import * as anchor from "@coral-xyz/anchor";
import { Program } from "@coral-xyz/anchor";
import { Sdrive } from "../target/types/sdrive";
import { Pda, User, getAPI } from "../app/api";
import { LAMPORTS_PER_SOL } from "@solana/web3.js";
import {
  createMint,
  createAssociatedTokenAccount,
  mintTo,
  TOKEN_PROGRAM_ID,
} from "@solana/spl-token";

import * as assert from "assert";


const BackendEnum = Object.freeze({
  ARWEAVE: 1,
  IPFS: 2,
});

const ExtEnum = Object.freeze({
  JPG: 1,
  JPEG: 2,
  PNG: 3,
  GIF: 4,
  PDF: 5,
  DOC: 6,
  DOCX: 7,
  XLS: 8,
  XLSX: 9,
  PPT: 10,
  PPTX: 11,
  TXT: 12,
  MP3: 13,
  WAV: 14,
  MP4: 15,
  AVI: 16,
  MOV: 17,
  HTML: 18,
  CSS: 19,
  JS: 20,
  JSON: 21,
  XML: 22,
  CSV: 23,
  ZIP: 24,
  RAR: 25,
  TAR: 26,
  GZ: 27,
  BMP: 28,
  TIFF: 29,
  PSD: 30,
  EPS: 31,
  AI: 32,
  SVG: 33,
  TTF: 34,
  OTF: 35,
  WEBP: 36,
  MKV: 37,
  FLV: 38,
  WMV: 39
});
function getExtensionByKey(keyValue: number) {
  for (const [key, value] of Object.entries(ExtEnum)) {
    if (value === keyValue) {
      return key;
    }
  }
  return null; // or undefined, or any default value you prefer
}
function getBackendEnumByKey(keyValue: number) {
  for (const [key, value] of Object.entries(BackendEnum)) {
    if (value === keyValue) {
      return key;
    }
  }
  return null; // or undefined, or any default value you prefer
}

// Generate users
const user = anchor.web3.Keypair.generate();
const second_user = anchor.web3.Keypair.generate();
const sdrive = anchor.web3.Keypair.generate();
//const user = anchor.web3.Keypair.fromSecretKey(secretKey);

describe("sdrive", () => {
  // Configure the client to use the local cluster.
  anchor.setProvider(anchor.AnchorProvider.env());

  const program = anchor.workspace.Sdrive as Program<Sdrive>;
  const {
    airdrop,
    getUserPda,
    // Fetch
    fetchDrive,
    fetchUser,
    fetchFiles,
    fetchStorageAccounts,
    // File
    createFile,
    createFileOnBehalfOfUser,
    deleteFile,
    // Create
    createUser,
    createStorageAccount,
    payUpload,
  } = getAPI(user.publicKey, program, [user]);

  let storage_account_1, storage_account_2;

  it("setup", async () => {
    await airdrop(user.publicKey, 10 * LAMPORTS_PER_SOL);
    await airdrop(sdrive.publicKey, 10 * LAMPORTS_PER_SOL);
  });

  it("create user", async () => {
    try {
      await createUser();
    } catch (e) {
      console.error(e)
    }
    const user = await fetchUser();
    assert.equal(user.storageAccounts, 0);
  });

  it("create storage account 1", async () => {
    try {
      await createStorageAccount(Buffer.from("my first storage account"));
    } catch (e) {
      console.error(e)
    }
    const userAccount = await fetchUser();
    assert.equal(userAccount.storageAccounts, 1);

    const storageAccounts = await fetchStorageAccounts(user.publicKey);
    assert.equal(storageAccounts.length, 1);
    assert.equal(storageAccounts[0].account.name.toString(), "my first storage account");
    //assert.equal(storageAccounts[0].publicKey, "asd");
    storage_account_1 = storageAccounts[0].publicKey;
  });

  it("create storage account 2", async () => {
    try {
      await createStorageAccount(Buffer.from("my second storage account"));
    } catch (e) {
      console.error(e)
    }
    const userAccount = await fetchUser();
    assert.equal(userAccount.storageAccounts, 2);
    const storageAccounts = await fetchStorageAccounts(user.publicKey);
    assert.equal(storageAccounts.length, 2);
    for (let account of storageAccounts) {
      if (account.publicKey.toBase58() !== storage_account_1.toBase58()) {
        storage_account_2 = account.publicKey;
      }
    }
  });

  it("list storage accounts", async () => {
    const userAccount = await fetchUser();
    assert.equal(userAccount.storageAccounts, 2);
    const storageAccounts = await fetchStorageAccounts(user.publicKey);
    assert.equal(storageAccounts.length, 2);
    let names = storageAccounts.map(sa => sa.account.name.toString());

    assert.equal(names.includes("my first storage account"), true);
    assert.equal(names.includes("my second storage account"), true);
  });

  it("should not list storage accounts for user 2", async () => {
    const storageAccounts = await fetchStorageAccounts(second_user.publicKey);
    assert.equal(storageAccounts.length, 0);
  });

  it("create file in first storage account with the behalf method", async () => {
    try {
      await createFileOnBehalfOfUser(Buffer.from("my first file"),
        Buffer.from("Qmb1qKM9SjdrxJV4Zd9ynKX3rtchpJZ99yiS5kVxr6RZyQ"),
        ExtEnum["JPG"],
        storage_account_1,
        sdrive.publicKey,
        BackendEnum["IPFS"],
        [sdrive]
      );
    } catch (e) {
      console.error(e)
    }
    const user = await fetchUser();
    assert.equal(user.fileCount, 1);
  });

  it("create 2nd file in first storage account", async () => {
    try {
      await createFile(Buffer.from("my second file"),
        Buffer.from("QmQiAdaVw63tMkUc7h5seNxe3mh7LHjACmnhrZgFeRrLmL"),
        ExtEnum["MP3"],
        storage_account_1,
        BackendEnum["ARWEAVE"]);
    } catch (e) {
      console.error(e)
    }
    const user = await fetchUser();
    assert.equal(user.fileCount, 2);
  });
  it("find all files in first storage account, and verify name, cid, ext and backend", async () => {
    const fileAccounts = await fetchFiles(storage_account_1, user.publicKey);
    assert.equal(fileAccounts.length, 2);
    let names = fileAccounts.map(data => data.account.name.toString());
    let cids = fileAccounts.map(data => data.account.cid.toString());
    let backends = fileAccounts.map(data => getBackendEnumByKey(data.account.backend));
    let exts = fileAccounts.map(data => getExtensionByKey(data.account.ext));
    assert.equal(names.includes("my first file"), true);
    assert.equal(names.includes("my second file"), true);
    assert.equal(cids.includes("Qmb1qKM9SjdrxJV4Zd9ynKX3rtchpJZ99yiS5kVxr6RZyQ"), true);
    assert.equal(cids.includes("QmQiAdaVw63tMkUc7h5seNxe3mh7LHjACmnhrZgFeRrLmL"), true);
    assert.equal(exts.includes("MP3"), true);
    assert.equal(exts.includes("JPG"), true);
    assert.equal(backends.includes("ARWEAVE"), true);
    assert.equal(backends.includes("IPFS"), true);
  });

  it("find single file (file 2) in first storage account", async () => {
    const fileAccounts = await fetchFiles(storage_account_1, user.publicKey, [2]);
    assert.equal(fileAccounts.length, 1);
    assert.equal(fileAccounts[0].account.name.toString(), "my second file");
    assert.equal(fileAccounts[0].account.cid.toString(), "QmQiAdaVw63tMkUc7h5seNxe3mh7LHjACmnhrZgFeRrLmL");
  });

  it("second storage account should not have any files", async () => {
    const fileAccounts = await fetchFiles(storage_account_2, user.publicKey);
    assert.equal(fileAccounts.length, 0);
  });

  it("find storage account by public key", async () => {
    const drive = await fetchDrive(user.publicKey, storage_account_1);
    assert.equal(drive.length, 1);
    assert.equal(drive[0].account.name.toString(), "my first storage account");
  });

  it("delete file in first storage account", async () => {
    try {
      const fileAccounts = await fetchFiles(storage_account_1, user.publicKey, [1]);
      //console.log("id in account (should be 1)",fileAccounts[0].account.id)
      assert.equal(fileAccounts[0].account.id, 1);
      await deleteFile(fileAccounts[0].publicKey, 1)
    } catch (e) {
      console.error(e)
    }
  });
  it("first storage account should only have 1 file after delete", async () => {
    const fileAccounts = await fetchFiles(storage_account_1, user.publicKey);
    assert.equal(fileAccounts.length, 1);
  });

  it("delete next file in first storage account", async () => {
    try {
      const fileAccounts = await fetchFiles(storage_account_1, user.publicKey, [2]);
      //console.log("id in account (should be 1)",fileAccounts[0].account.id)
      assert.equal(fileAccounts[0].account.id, 2);
      await deleteFile(fileAccounts[0].publicKey, 2)
    } catch (e) {
      console.error(e)
    }
  });
  it("first storage account should have no files after delete", async () => {
    const fileAccounts = await fetchFiles(storage_account_1, user.publicKey);
    assert.equal(fileAccounts.length, 0);
  });

  it("create 3rd file in first storage account", async () => {
    await createFile(
      Buffer.from("my third file"),
      Buffer.from("QmQiAdaVw63tMkUc7h5seNxe3mh7LHjACmnhrZgFeRrLmL"),
      ExtEnum["MP3"],
      storage_account_1,
      BackendEnum["ARWEAVE"]);

    const user = await fetchUser();
    assert.equal(user.fileCount, 1);
  });

  it("first storage account should now have 1 fileAccount", async () => {
    const fileAccounts = await fetchFiles(storage_account_1, user.publicKey);
    assert.equal(fileAccounts.length, 1);
  });


  it("pay with scoin for upload", async () => {
    // Create a new mint and initialize it
    const mintKp = new anchor.web3.Keypair();
    const fromKp = user;// new anchor.web3.Keypair();
    const toKp = new anchor.web3.Keypair();
    await airdrop(mintKp.publicKey, 10 * LAMPORTS_PER_SOL);
    await airdrop(toKp.publicKey, 10 * LAMPORTS_PER_SOL);
    await airdrop(fromKp.publicKey, 10 * LAMPORTS_PER_SOL);
    const connection = program.provider.connection;
    try {
      const mint = await createMint(
        connection,
        fromKp,
        fromKp.publicKey,
        null,
        0
      );
      // Create associated token accounts for the new accounts
      const fromAta = await createAssociatedTokenAccount(
        connection,
        fromKp,
        mint,
        fromKp.publicKey
      );
      const toAta = await createAssociatedTokenAccount(
        connection,
        fromKp,
        mint,
        toKp.publicKey
      );
      // Mint tokens to the 'from' associated token account
      const mintAmount = 1000;
      await mintTo(
        connection,
        fromKp,
        mint,
        fromAta,
        fromKp.publicKey,
        mintAmount
      );
      const transferAmount = new anchor.BN(500);
      await payUpload(500, fromAta, toAta);
      const toTokenAccount = await connection.getTokenAccountBalance(toAta);

      assert.strictEqual(
        toTokenAccount.value.uiAmount,
        transferAmount.toNumber(),
        "The 'to' token account should have the transferred tokens"
      );
    } catch (e) {
      console.log(e)
    }

  });
});
