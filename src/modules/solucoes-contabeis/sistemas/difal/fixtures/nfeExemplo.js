// NF-e sintética para teste do motor de DIFAL. Fornecedor no PR (regime
// normal) vendendo para cliente do Simples Nacional em SP.
//
// Cada item existe para exercitar um caminho diferente do motor:
//
//   1  perfume 3307.10.00   uso e consumo  → posição 3307 → 25%
//   2  desodorante 3307.20  uso e consumo  → exceção 3307.20 → regra geral 18%
//   3  notebook importado   ativo          → 8471 18% x 4% importado, IPI na base
//   4  detergente com ST    uso e consumo  → CST 60, sem DIFAL
//   5  cigarro 2402.20.00   uso e consumo  → 25% + FCP 2%
//   6  NCM fora do padrão   uso e consumo  → pendente
//   7  camiseta revenda     CFOP 6102      → sem DIFAL em SP (revenda)
//
// Os valores são redondos de propósito: o resultado esperado do teste tem que
// ser conferível na mão, no papel, por quem entende de fiscal e não de código.

export const XML_NFE_EXEMPLO = `<?xml version="1.0" encoding="UTF-8"?>
<nfeProc versao="4.00" xmlns="http://www.portalfiscal.inf.br/nfe">
  <NFe>
    <infNFe Id="NFe41260812345678000199550010000012341000012340" versao="4.00">
      <ide>
        <cUF>41</cUF>
        <natOp>VENDA DE MERCADORIA</natOp>
        <mod>55</mod>
        <serie>1</serie>
        <nNF>1234</nNF>
        <dhEmi>2026-08-14T10:32:00-03:00</dhEmi>
        <idDest>2</idDest>
        <finNFe>1</finNFe>
      </ide>
      <emit>
        <CNPJ>12345678000199</CNPJ>
        <xNome>Distribuidora Alfa &amp; Cia Ltda</xNome>
        <enderEmit>
          <xMun>Curitiba</xMun>
          <UF>PR</UF>
        </enderEmit>
        <CRT>3</CRT>
      </emit>
      <dest>
        <CNPJ>98765432000110</CNPJ>
        <xNome>Comercio Beta ME</xNome>
        <enderDest>
          <xMun>Sao Paulo</xMun>
          <UF>SP</UF>
        </enderDest>
        <indIEDest>1</indIEDest>
      </dest>

      <det nItem="1">
        <prod>
          <cProd>PERF-001</cProd>
          <xProd>Perfume 100ml</xProd>
          <NCM>33071000</NCM>
          <CFOP>6556</CFOP>
          <uCom>UN</uCom>
          <qCom>10.0000</qCom>
          <vUnCom>100.0000000000</vUnCom>
          <vProd>1000.00</vProd>
          <vFrete>100.00</vFrete>
          <indTot>1</indTot>
        </prod>
        <imposto>
          <ICMS>
            <ICMS00>
              <orig>0</orig>
              <CST>00</CST>
              <modBC>3</modBC>
              <vBC>1100.00</vBC>
              <pICMS>12.00</pICMS>
              <vICMS>132.00</vICMS>
            </ICMS00>
          </ICMS>
        </imposto>
      </det>

      <det nItem="2">
        <prod>
          <cProd>DESO-002</cProd>
          <xProd>Desodorante aerosol</xProd>
          <NCM>33072010</NCM>
          <CFOP>6556</CFOP>
          <uCom>UN</uCom>
          <qCom>50.0000</qCom>
          <vUnCom>10.0000000000</vUnCom>
          <vProd>500.00</vProd>
          <indTot>1</indTot>
        </prod>
        <imposto>
          <ICMS>
            <ICMS00>
              <orig>0</orig>
              <CST>00</CST>
              <modBC>3</modBC>
              <vBC>500.00</vBC>
              <pICMS>12.00</pICMS>
              <vICMS>60.00</vICMS>
            </ICMS00>
          </ICMS>
        </imposto>
      </det>

      <det nItem="3">
        <prod>
          <cProd>NOTE-003</cProd>
          <xProd>Notebook 14"</xProd>
          <NCM>84713012</NCM>
          <CFOP>6551</CFOP>
          <uCom>UN</uCom>
          <qCom>1.0000</qCom>
          <vUnCom>3000.0000000000</vUnCom>
          <vProd>3000.00</vProd>
          <indTot>1</indTot>
        </prod>
        <imposto>
          <ICMS>
            <ICMS00>
              <orig>1</orig>
              <CST>00</CST>
              <modBC>3</modBC>
              <vBC>3000.00</vBC>
              <pICMS>4.00</pICMS>
              <vICMS>120.00</vICMS>
            </ICMS00>
          </ICMS>
          <IPI>
            <IPITrib>
              <vBC>3000.00</vBC>
              <pIPI>5.00</pIPI>
              <vIPI>150.00</vIPI>
            </IPITrib>
          </IPI>
        </imposto>
      </det>

      <det nItem="4">
        <prod>
          <cProd>DET-004</cProd>
          <xProd>Detergente 500ml</xProd>
          <NCM>34022000</NCM>
          <CFOP>6556</CFOP>
          <uCom>UN</uCom>
          <qCom>20.0000</qCom>
          <vUnCom>5.0000000000</vUnCom>
          <vProd>100.00</vProd>
          <indTot>1</indTot>
        </prod>
        <imposto>
          <ICMS>
            <ICMS60>
              <orig>0</orig>
              <CST>60</CST>
              <vBCSTRet>140.00</vBCSTRet>
              <vICMSSTRet>25.20</vICMSSTRet>
            </ICMS60>
          </ICMS>
        </imposto>
      </det>

      <det nItem="5">
        <prod>
          <cProd>CIG-005</cProd>
          <xProd>Cigarrilha caixa</xProd>
          <NCM>24022000</NCM>
          <CFOP>6556</CFOP>
          <uCom>CX</uCom>
          <qCom>4.0000</qCom>
          <vUnCom>50.0000000000</vUnCom>
          <vProd>200.00</vProd>
          <indTot>1</indTot>
        </prod>
        <imposto>
          <ICMS>
            <ICMS00>
              <orig>0</orig>
              <CST>00</CST>
              <modBC>3</modBC>
              <vBC>200.00</vBC>
              <pICMS>12.00</pICMS>
              <vICMS>24.00</vICMS>
            </ICMS00>
          </ICMS>
        </imposto>
      </det>

      <det nItem="6">
        <prod>
          <cProd>DIV-006</cProd>
          <xProd>Item com NCM incompleto</xProd>
          <NCM>0000</NCM>
          <CFOP>6556</CFOP>
          <uCom>UN</uCom>
          <qCom>1.0000</qCom>
          <vUnCom>80.0000000000</vUnCom>
          <vProd>80.00</vProd>
          <indTot>1</indTot>
        </prod>
        <imposto>
          <ICMS>
            <ICMS00>
              <orig>0</orig>
              <CST>00</CST>
              <modBC>3</modBC>
              <vBC>80.00</vBC>
              <pICMS>12.00</pICMS>
              <vICMS>9.60</vICMS>
            </ICMS00>
          </ICMS>
        </imposto>
      </det>

      <det nItem="7">
        <prod>
          <cProd>CAM-007</cProd>
          <xProd>Camiseta algodao</xProd>
          <NCM>61091000</NCM>
          <CFOP>6102</CFOP>
          <uCom>UN</uCom>
          <qCom>30.0000</qCom>
          <vUnCom>20.0000000000</vUnCom>
          <vProd>600.00</vProd>
          <indTot>1</indTot>
        </prod>
        <imposto>
          <ICMS>
            <ICMS00>
              <orig>0</orig>
              <CST>00</CST>
              <modBC>3</modBC>
              <vBC>600.00</vBC>
              <pICMS>12.00</pICMS>
              <vICMS>72.00</vICMS>
            </ICMS00>
          </ICMS>
        </imposto>
      </det>

      <total>
        <ICMSTot>
          <vProd>5480.00</vProd>
          <vFrete>100.00</vFrete>
          <vSeg>0.00</vSeg>
          <vDesc>0.00</vDesc>
          <vOutro>0.00</vOutro>
          <vIPI>150.00</vIPI>
          <vNF>5730.00</vNF>
        </ICMSTot>
      </total>
      <infAdic>
        <infCpl><![CDATA[Pedido 4567 - contato: vendas@alfa.com.br]]></infCpl>
      </infAdic>
    </infNFe>
  </NFe>
  <protNFe versao="4.00">
    <infProt>
      <chNFe>41260812345678000199550010000012341000012340</chNFe>
      <cStat>100</cStat>
      <xMotivo>Autorizado o uso da NF-e</xMotivo>
    </infProt>
  </protNFe>
</nfeProc>`;

export default XML_NFE_EXEMPLO;
