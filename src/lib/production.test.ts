import {expect,test} from "vitest";
import {dishBuffer, fmtProdQty} from "./production";
const b={v1:5,v4:0,v5:10};
test("active 0% wins over pinned 5%",()=>expect(dishBuffer({recipe_version_id:"v1",recipe:{active_version_id:"v4"}},b)).toBe(0));
test("45 each",()=>{for(const [p,e] of [[5,48],[0,45],[10,50]]) expect(fmtProdQty(45*(1+p/100),"each")).toBe(`${e} each`)});
test("20x1.1=22",()=>expect(fmtProdQty(20*1.1,"each")).toBe("22 each"));
