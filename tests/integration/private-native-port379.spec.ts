import {test,expect} from '@playwright/test';
import {writeFile} from 'node:fs/promises';
test.skip(process.env.NATIVE_PRIVATE_PORT379!=='1','Opt-in only; real fixed Worker native browser contract.');
test('fixed Main private port receives genuine Fulls, phases and ACKs on one ordered source',async({page},info)=>{
 const errors:string[]=[];page.on('pageerror',error=>errors.push(String(error)));let report:unknown;
 try{
  await page.route('**/__private_native_port379',route=>route.fulfill({contentType:'text/html',body:'<!doctype html><meta charset="utf-8"><title>Private native port</title>'}));await page.goto('/__private_native_port379');
  report=await page.evaluate(async()=>{const source='/tests/integration/private-native-port379-browser.ts';return (await import(/* @vite-ignore */source)).runPrivateNativePortContracts379();});
 }catch(error){report={status:'failed',error:String(error)};}
 await writeFile(info.outputPath('contracts.json'),JSON.stringify({report,errors},null,2));expect(errors).toEqual([]);expect(report).toMatchObject({status:'passed',direct:0});
});
test('fixed Main private opaque Full never exposes raw auxiliary authority or permits valid input mutation',async({page},info)=>{
 const errors:string[]=[];page.on('pageerror',error=>errors.push(String(error)));let report:unknown;
 try{
  await page.route('**/__private_native_port641',route=>route.fulfill({contentType:'text/html',body:'<!doctype html><meta charset="utf-8"><title>Opaque private native port</title>'}));await page.goto('/__private_native_port641');
  report=await page.evaluate(async()=>{const source='/tests/integration/private-native-port641-browser.ts';return (await import(/* @vite-ignore */source)).runOpaqueNativePortContracts379();});
 }catch(error){report={status:'failed',error:String(error)};}
 await writeFile(info.outputPath('opaque-contracts.json'),JSON.stringify({report,errors},null,2));expect(errors).toEqual([]);expect(report).toMatchObject({status:'passed',direct:0});
});
