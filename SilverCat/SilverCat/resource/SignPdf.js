if (typeof SilverCat == "undefined") {
        var SilverCat = {};
}
SilverCat.sigField_cName = "SilverCatSignatureField";
SilverCat.sigField_cFieldType = "signature";

/**
* PDFファイルに電子署名します。
* @param doc 電子署名対象のPDFドキュメント。
* @param pwd 電子証明書パスワード。
* @param did 電子証明書ファイルのフルパス。パス区切り文字は"/"。
* @param policy セキュリティポリシー名。
* @param x 電子署名フィールド配置位置左上x座標。
* @param y 電子署名フィールド配置位置左上y座標。
* @param width 電子署名フィールド幅。
* @param height 電子署名フィールド高さ。
*/
function SignPdf(doc, pwd, did, policy, x, y, width, height) {
  try {
    var field = AddSignatureField(doc, SilverCat.sigField_cName, SilverCat.sigField_cFieldType, x, y, width, height);
    if(field) {
      EmbedSignToPdf(doc, field, pwd, did, policy);
    }
    event.value = "0";
  } catch(e) {
    event.value = "Exception:" + e;
    console.println(e);
  }
}

/**
* PDFドキュメントに電子署名フィールドを追加します。
* @param doc 電子署名対象のPDFドキュメント。
* @param cName 電子署名フィールド名。
* @param cFieldType フィールドタイプ。電子署名を打つので、"signature"。
* @return 電子署名フィールド。
*/
function AddSignatureField(doc, cName, cFieldType, x, y, width, height) {
  // フィールドの座標定義
  // 左下隅が原点(x,y)の(0,0)
  // A4縦のPDFドキュメントのPageBoxをgetすると、
  // rect[0]=0,rect[1]=792,rect[2]=612,rect[3]=0
  // となる。
  var rectangle = doc.getPageBox( {nPage: 0} );
  
  rectangle[0] = x; // 左上x座標。プラスで右に行く。
  rectangle[1] -= y; // 左上y座標。マイナスで下に行く。
  rectangle[2] = rectangle[0] + width; // 幅。プラスで右に行く。
  rectangle[3] = rectangle[1] - height; // 高。マイナスで下に行く。

  var field = null;
  try {
    // PDFDocument.addField()
    // cName:フィールド名。PDFドキュメントの中でダブらなければよいでしょう。
    // cFieldType:フィールドタイプ。電子署名を打つので、"signature"。
    // nPageNum:ページ番号はゼロから始まる。ゼロならば、先頭のページに電子署名フィールドを追加。
    // aRect:電子署名フィールド座標
    field = doc.addField(cName, cFieldType, 0, rectangle);
    // 可視とする。
    field.hidden = false;
    // 印刷対象外とする。
    field.print = false;
  } catch (e) {
    throw e;
  }
  return field;
}

/**
* 電子署名フィールドに電子署名を埋め込みます。
* @param sigField 電子署名フィールド。
* @param pwd 電子証明書パスワード。
* @param did 電子証明書ファイルのフルパス。
* @param policy セキュリティポリシー名。
*/
EmbedSignToPdf = app.trustedFunction (
  function(doc, sigField, pwd, did, policy) {
    try {
      app.beginPriv();

      var sh = security.getHandler(security.PPKLiteHandler, false);
      sh.login(pwd, did);

      // 公開鍵によるセキュリティ設定:
      // PDFファイル受信者の公開鍵で暗号化する。
      // PDFファイルを開くには上記公開鍵のペアである秘密鍵でないと開けない。
/*
      // 受信者の公開鍵証明書の取り込み(X509.3)
      var tarou = security.importFromFile("Certificate", "C:/temp/pub_tarou.cer" );
      var hanako = security.importFromFile("Certificate", "C:/temp/pub_hanako.cer" );
      // 受信者グループ毎にアクセス権限を設定
      var group1 = { userEntities: [ {certificates: [tarou] } ], permissions: {allowAll: true} };
      var group2 = { userEntities: [ {certificates: [hanako] } ], permissions: {allowChanges: "fillAndSign"} };
      // 受信者の公開鍵で暗号化
      doc.encryptForRecipients({ oGroups: [group1, group2] , bMetaData: true } );
*/

      // セキュティポリシーによるセキュリティ設定：
      // Acrobat Pro XIの場合：
      // 「表示(V)」「ツール(T)」でツールパネルを表示。
      // 「保護」アコーディオン、「暗号化」アコーディオンをクリックし、
      // 「セキュリティポリシーを管理(M)...」をクリック。
      // 「セキュリティポリシーの管理」ダイアログで登録したセキュリティーポリシーの名前で
      // 登録しておいたセキュリティポリシーにより、PDFファイルにセキュリティを設定する。

      // セキュリティポリシーの検索。
      var options = { cHandler:security.StandardHandler };
      var policyArray = security.getSecurityPolicies( { oOptions: options } );
      var myPolicy = null;
      for( var i = 0; i < policyArray.length; i++) {
        if( policyArray[i].name == policy ) {
            myPolicy = policyArray[i];
            break;
        }
      }
      // セキュリティポリシーの設定。
      var res = doc.encryptUsingPolicy({ oPolicy: myPolicy , oHandler: sh, bUI: false } );
      if( res.errorCode != 0 ) {
        throw res.errorText;
      }

      // 電子署名情報の設定。
      // mdp:"allowAll":普通署名。
      //     "allowNone","default","defaultAndComments":MDP署名。
      var sigInfo = {
        mdp: "allowNone"
      };
      // 電子署名をする。
      sigField.signatureSign({oSig: sh, oInfo: sigInfo, bUI: false});

      app.endPriv();
    } catch (e) {
      throw e;
    }
  }
);
