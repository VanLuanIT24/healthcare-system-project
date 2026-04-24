export const NEWS_CATEGORIES = [
  { id: 'all', label: 'Tất cả' },
  { id: 'nutrition', label: 'Dinh dưỡng' },
  { id: 'psychology', label: 'Tâm lý' },
  { id: 'technology', label: 'Công nghệ' },
  { id: 'recovery', label: 'Phục hồi' },
];

export const NEWS_ARTICLES = [
  {
    slug: 'genomics-chinh-xac-ca-nhan-hoa-dieu-tri',
    category: 'technology',
    tag: 'CÔNG NGHỆ',
    title: 'Genomics đang tái định hình điều trị chính xác như thế nào',
    excerpt: 'Các nền tảng phân tích gene mới giúp bác sĩ chọn phác đồ gần với từng bệnh nhân hơn thay vì chỉ dựa vào nhóm bệnh chung.',
    readTime: '8 phút đọc',
    publishedAt: '08/04/2026',
    author: 'Tiến sĩ Nguyễn Hoàng Anh',
    role: 'Trưởng khoa Nghiên cứu Di truyền',
    image: 'https://images.unsplash.com/photo-1532187863486-abf9dbad1b69?auto=format&fit=crop&w=1200&q=80',
    sections: [
      {
        heading: 'Điều gì đang thay đổi',
        paragraphs: [
          'Trong nhiều năm, điều trị chủ yếu được xây dựng theo nhóm bệnh lớn. Cùng một chẩn đoán, nhiều bệnh nhân vẫn nhận phác đồ gần giống nhau mặc dù phản ứng điều trị, khả năng dung nạp thuốc và tốc độ hồi phục khác biệt đáng kể.',
          'Genomics đang thay đổi điều đó bằng cách bổ sung một lớp dữ liệu sâu hơn: cách cơ thể từng người phản ứng với nguy cơ bệnh, chuyển hóa thuốc và các dấu ấn sinh học liên quan đến tiến triển lâm sàng.',
        ],
      },
      {
        heading: 'Ý nghĩa trong thực hành lâm sàng',
        paragraphs: [
          'Trong môi trường bệnh viện hiện đại, dữ liệu gene không hoạt động riêng lẻ. Nó được đặt cạnh hình ảnh học, xét nghiệm máu, hồ sơ bệnh sử và triệu chứng thực tế để giúp hội đồng liên chuyên khoa đưa ra kế hoạch điều trị hợp lý hơn.',
          'Điều quan trọng là không phải bệnh nhân nào cũng cần xét nghiệm gene ở cùng một mức độ. Giá trị của genomics nằm ở việc chọn đúng thời điểm, đúng mục tiêu và giải thích kết quả đủ rõ để bệnh nhân hiểu quyết định điều trị đang đi theo hướng nào.',
        ],
      },
      {
        heading: 'Bước tiếp theo cho bệnh nhân',
        paragraphs: [
          'Thay vì xem genomics như một công nghệ “xa xỉ”, nhiều trung tâm đang dùng nó như một công cụ hỗ trợ quyết định ở những ca cần cá nhân hóa cao. Điều này đặc biệt có ý nghĩa trong ung bướu, bệnh mạn tính phức tạp và các chương trình phòng ngừa nguy cơ gia đình.',
          'Điểm mấu chốt không nằm ở việc có càng nhiều dữ liệu càng tốt, mà là dùng đúng dữ liệu để tránh thử-sai kéo dài và rút ngắn hành trình đi đến điều trị hiệu quả.',
        ],
      },
    ],
  },
  {
    slug: 'che-do-an-chong-viem-cho-giai-doan-phuc-hoi',
    category: 'nutrition',
    tag: 'DINH DƯỠNG',
    title: 'Chế độ ăn chống viêm trong giai đoạn phục hồi nên bắt đầu từ đâu',
    excerpt: 'Phục hồi tốt không chỉ nằm ở thuốc và nghỉ ngơi, mà còn ở cách lựa chọn bữa ăn để giữ năng lượng và giảm viêm nền.',
    readTime: '6 phút đọc',
    publishedAt: '07/04/2026',
    author: 'BS. Trần Khánh Linh',
    role: 'Trung tâm Dinh dưỡng Lâm sàng',
    image: 'https://images.unsplash.com/photo-1490645935967-10de6ba17061?auto=format&fit=crop&w=1200&q=80',
    sections: [
      {
        heading: 'Viêm nền ảnh hưởng đến hồi phục ra sao',
        paragraphs: [
          'Sau phẫu thuật, trong điều trị bệnh mạn tính hoặc sau giai đoạn cấp cứu, cơ thể cần năng lượng ổn định để tái tạo mô, giữ khối cơ và kiểm soát phản ứng viêm. Nếu bữa ăn thiếu cân bằng, người bệnh dễ mệt kéo dài và ngủ kém hơn.',
          'Một chế độ ăn chống viêm không có nghĩa là quá kiêng khem. Trọng tâm là ưu tiên thực phẩm nguyên bản, đủ đạm, giàu chất xơ và hạn chế những nguồn đường nhanh hoặc thực phẩm siêu chế biến làm tăng dao động năng lượng.',
        ],
      },
      {
        heading: 'Ba nguyên tắc đơn giản',
        paragraphs: [
          'Thứ nhất, mỗi bữa nên có nguồn đạm rõ ràng như cá, trứng, đậu, sữa chua hoặc thịt nạc để hỗ trợ sửa chữa mô. Thứ hai, bổ sung rau nhiều màu và trái cây giàu polyphenol để tăng vi chất và chất chống oxy hóa.',
          'Thứ ba, dùng chất béo tốt từ dầu ô liu, quả bơ, hạt và cá béo để hỗ trợ kiểm soát viêm. Những điều chỉnh nhỏ nhưng bền vững sẽ hiệu quả hơn nhiều so với việc theo một chế độ quá cực đoan trong vài ngày.',
        ],
      },
      {
        heading: 'Cá nhân hóa là yếu tố quyết định',
        paragraphs: [
          'Người đang hóa trị, bệnh nhân tim mạch, người có bệnh thận hay trẻ nhỏ trong giai đoạn hồi phục sẽ cần cấu trúc bữa ăn khác nhau. Vì vậy, dinh dưỡng phục hồi tốt nhất khi gắn với tình trạng bệnh và mục tiêu điều trị cụ thể.',
          'Một kế hoạch dinh dưỡng hợp lý không chỉ giúp người bệnh ăn “đúng”, mà còn cảm thấy ăn uống trở lại là một phần tích cực của quá trình hồi phục.',
        ],
      },
    ],
  },
  {
    slug: 'thien-dinh-ho-tro-ngu-ngon-va-giam-lo-au',
    category: 'psychology',
    tag: 'TÂM LÝ',
    title: 'Thiền định ngắn mỗi ngày có thể hỗ trợ giấc ngủ và lo âu ra sao',
    excerpt: 'Một số bài tập chánh niệm 5 đến 10 phút đang được đưa vào chương trình phục hồi để giảm quá tải tinh thần.',
    readTime: '7 phút đọc',
    publishedAt: '07/04/2026',
    author: 'ThS. Lê Phương Mai',
    role: 'Đơn vị Tâm lý lâm sàng',
    image: 'https://images.unsplash.com/photo-1506126613408-eca07ce68773?auto=format&fit=crop&w=1200&q=80',
    sections: [
      {
        heading: 'Vì sao người bệnh khó thư giãn',
        paragraphs: [
          'Ngay cả khi các chỉ số điều trị ổn định, nhiều người bệnh vẫn mô tả cảm giác căng liên tục. Đó là phản ứng dễ hiểu khi cơ thể đang phải thích nghi với đau, lo lắng về kết quả và sự thay đổi nhịp sinh hoạt.',
          'Nếu hệ thần kinh luôn ở trạng thái cảnh giác, chất lượng ngủ và khả năng hồi phục ban ngày đều giảm. Thiền định ngắn không thay thế trị liệu, nhưng có thể là một công cụ đầu vào nhẹ nhàng để giảm độ căng nền.',
        ],
      },
      {
        heading: 'Chánh niệm có thể bắt đầu rất nhỏ',
        paragraphs: [
          'Nhiều bệnh nhân nghĩ thiền là ngồi lâu hoặc cần không gian đặc biệt. Thực tế, một bài tập quan sát hơi thở trong 5 phút, kết hợp thả lỏng vai cổ hoặc ghi nhận cảm giác cơ thể, đã đủ để tạo một “khoảng nghỉ” thần kinh.',
          'Quan trọng nhất là sự đều đặn. Việc lặp lại hằng ngày giúp não học lại tín hiệu an toàn, từ đó cải thiện khả năng quay về trạng thái bình tĩnh sau những thời điểm căng thẳng.',
        ],
      },
      {
        heading: 'Khi nào nên tìm thêm hỗ trợ',
        paragraphs: [
          'Nếu mất ngủ kéo dài, cơn lo âu lặp lại hoặc có cảm giác quá tải ảnh hưởng đến ăn uống và tương tác hằng ngày, người bệnh nên được đánh giá bài bản hơn bởi bác sĩ hoặc chuyên gia tâm lý.',
          'Thiền định là một phần của chăm sóc tinh thần, nhưng hiệu quả nhất khi nằm trong một lộ trình hỗ trợ có theo dõi và cá nhân hóa.',
        ],
      },
    ],
  },
  {
    slug: 'the-he-moi-ai-trong-chan-doan-som',
    category: 'technology',
    tag: 'CÔNG NGHỆ',
    title: 'Thế hệ AI mới trong chẩn đoán sớm đang hỗ trợ bác sĩ ở đâu',
    excerpt: 'AI không thay thế quyết định lâm sàng, nhưng đang giúp đội ngũ y tế đọc nhanh hơn và ưu tiên ca nguy cơ tốt hơn.',
    readTime: '9 phút đọc',
    publishedAt: '06/04/2026',
    author: 'BS. Vũ Minh Khang',
    role: 'Đơn vị Chẩn đoán Hình ảnh',
    image: 'https://images.unsplash.com/photo-1576671081837-49000212a370?auto=format&fit=crop&w=1200&q=80',
    sections: [
      {
        heading: 'AI đang đi vào quy trình nào',
        paragraphs: [
          'Trong thực tế bệnh viện, AI hiện diện nhiều nhất ở các tác vụ lặp lại và cần tốc độ như sàng lọc hình ảnh, nhận diện vùng bất thường hoặc sắp xếp mức ưu tiên đọc cho bác sĩ.',
          'Nhờ đó, các ca có tín hiệu nghi ngờ cao được đưa lên sớm hơn trong hàng đợi, giúp rút ngắn thời gian phản hồi ở những thời điểm lượng bệnh nhân tăng mạnh.',
        ],
      },
      {
        heading: 'Điểm cần nhìn đúng',
        paragraphs: [
          'Giá trị thực tế của AI không nằm ở “độ thông minh” được quảng bá, mà ở việc nó có giúp giảm bỏ sót, giảm thời gian thao tác và tăng tính nhất quán trong một quy trình có bác sĩ giám sát hay không.',
          'AI tốt là AI hoạt động như lớp hỗ trợ nền, chứ không làm quá trình chăm sóc trở nên khó hiểu hơn với người bệnh.',
        ],
      },
      {
        heading: 'Tương lai gần',
        paragraphs: [
          'Nhiều mô hình mới đang kết hợp hình ảnh, xét nghiệm và hồ sơ bệnh để tạo ra hệ thống cảnh báo sớm đa dữ liệu. Điều này đặc biệt hữu ích với các chương trình phòng ngừa và theo dõi định kỳ.',
          'Tuy nhiên, để ứng dụng an toàn, bệnh viện vẫn cần khung kiểm chứng chất lượng, tiêu chuẩn đạo đức dữ liệu và cơ chế bác sĩ chịu trách nhiệm cuối cùng.',
        ],
      },
    ],
  },
  {
    slug: 'khong-gian-tu-nhien-trong-phuc-hoi-hien-dai',
    category: 'recovery',
    tag: 'PHỤC HỒI',
    title: 'Không gian tự nhiên tác động thế nào đến tốc độ phục hồi hiện đại',
    excerpt: 'Ánh sáng, âm thanh và cảm giác an toàn trong không gian điều trị đang được xem là một phần của chăm sóc chứ không chỉ là trang trí.',
    readTime: '6 phút đọc',
    publishedAt: '06/04/2026',
    author: 'KTS. Hoàng Đức Nam',
    role: 'Cố vấn không gian phục hồi',
    image: 'https://images.unsplash.com/photo-1516574187841-cb9cc2ca948b?auto=format&fit=crop&w=1200&q=80',
    sections: [
      {
        heading: 'Không gian có thể làm dịu hệ thần kinh',
        paragraphs: [
          'Một căn phòng quá ồn, thiếu ánh sáng tự nhiên hoặc luôn tạo cảm giác mất định hướng có thể khiến người bệnh khó nghỉ ngơi thực sự. Ngược lại, không gian dễ đoán, sáng vừa đủ và có điểm nhìn thoáng giúp hệ thần kinh bớt căng.',
          'Nhiều mô hình phục hồi hiện đại vì vậy bắt đầu thiết kế trải nghiệm từ lối vào, khu chờ, màu sắc và hướng di chuyển thay vì chỉ tập trung vào buồng điều trị.',
        ],
      },
      {
        heading: 'Tác động không chỉ là cảm giác',
        paragraphs: [
          'Khi mức độ căng thẳng nền giảm, giấc ngủ, nhịp sinh hoạt và cảm nhận đau thường dễ cải thiện hơn. Điều này gián tiếp hỗ trợ người bệnh hợp tác tốt hơn với trị liệu và duy trì năng lượng trong ngày.',
          'Không gian chữa lành không phải là yếu tố “thêm vào”, mà là phần nền để các can thiệp y khoa phát huy hiệu quả tốt hơn.',
        ],
      },
      {
        heading: 'Thiết kế phục hồi là thiết kế có chủ đích',
        paragraphs: [
          'Những chi tiết như ghế ngồi gần cửa sổ, khu vực yên tĩnh cho thân nhân, vật liệu dễ chịu với ánh sáng ấm và luồng di chuyển rõ ràng đều là những quyết định có mục tiêu lâm sàng.',
          'Một bệnh viện hiện đại không chỉ cần công nghệ cao, mà còn cần biết làm thế nào để bệnh nhân cảm thấy an toàn ngay từ khi bước vào.',
        ],
      },
    ],
  },
  {
    slug: 'microbiome-va-suc-khoe-mien-dich-toan-than',
    category: 'nutrition',
    tag: 'DINH DƯỠNG',
    title: 'Microbiome và sức khỏe miễn dịch toàn thân đang được hiểu lại',
    excerpt: 'Sức khỏe đường ruột không còn chỉ là câu chuyện tiêu hóa mà đang liên quan tới miễn dịch, chuyển hóa và phục hồi năng lượng.',
    readTime: '7 phút đọc',
    publishedAt: '05/04/2026',
    author: 'TS. Phạm Thu Hà',
    role: 'Nhà nghiên cứu vi sinh y học',
    image: 'https://images.unsplash.com/photo-1530026186672-2cd00ffc50fe?auto=format&fit=crop&w=1200&q=80',
    sections: [
      {
        heading: 'Microbiome là gì',
        paragraphs: [
          'Microbiome là hệ sinh thái vi sinh vật sống trong cơ thể, nổi bật nhất là ở đường ruột. Hệ này có vai trò trong tiêu hóa, chuyển hóa và huấn luyện đáp ứng miễn dịch.',
          'Khi hệ vi sinh mất cân bằng kéo dài do stress, thuốc, chế độ ăn hoặc bệnh lý, người bệnh có thể gặp nhiều biểu hiện từ đầy bụng, mệt mỏi đến giảm khả năng hồi phục.',
        ],
      },
      {
        heading: 'Vì sao giới lâm sàng quan tâm',
        paragraphs: [
          'Ngày càng có nhiều bằng chứng cho thấy sức khỏe đường ruột liên quan tới mức viêm nền và khả năng thích nghi của cơ thể trong điều trị dài ngày. Điều này khiến microbiome trở thành một chủ đề quan trọng trong chăm sóc toàn diện.',
          'Tuy vậy, đây vẫn là lĩnh vực cần được giải thích cẩn trọng. Không phải mọi vấn đề sức khỏe đều có thể quy về đường ruột, và không phải sản phẩm men vi sinh nào cũng phù hợp với mọi người.',
        ],
      },
      {
        heading: 'Ứng dụng thực tế hiện nay',
        paragraphs: [
          'Trong thực hành, ưu tiên vẫn là cải thiện nền tảng: ăn đủ chất xơ, ngủ đều, hạn chế sử dụng kháng sinh không cần thiết và theo dõi triệu chứng có hệ thống.',
          'Khi cần can thiệp chuyên sâu hơn, việc đánh giá microbiome nên nằm trong một bối cảnh lâm sàng rõ ràng để tránh kỳ vọng quá mức vào các giải pháp nhanh.',
        ],
      },
    ],
  },
  {
    slug: 'tam-ly-gia-dinh-trong-dieu-tri-nhi-khoa',
    category: 'psychology',
    tag: 'TÂM LÝ',
    title: 'Tâm lý gia đình giữ vai trò gì trong điều trị nhi khoa dài ngày',
    excerpt: 'Không chỉ trẻ cần được chăm sóc, mà cha mẹ cũng cần được hỗ trợ để đồng hành đủ bền trong hành trình điều trị.',
    readTime: '6 phút đọc',
    publishedAt: '05/04/2026',
    author: 'ThS. Nguyễn Gia Hân',
    role: 'Chuyên gia tâm lý gia đình',
    image: 'https://images.unsplash.com/photo-1519494026892-80bbd2d6fd0d?auto=format&fit=crop&w=1200&q=80',
    sections: [
      {
        heading: 'Cha mẹ là một phần của điều trị',
        paragraphs: [
          'Trong nhi khoa, trạng thái cảm xúc của cha mẹ ảnh hưởng trực tiếp đến cảm giác an toàn của trẻ. Khi người lớn quá căng thẳng hoặc thiếu thông tin, trẻ thường dễ lo lắng hơn và ít hợp tác hơn trong can thiệp.',
          'Điều đó không có nghĩa cha mẹ phải luôn mạnh mẽ. Ngược lại, hệ thống chăm sóc tốt cần tạo điều kiện để gia đình được giải thích rõ, được nghỉ và được hỗ trợ tinh thần đúng lúc.',
        ],
      },
      {
        heading: 'Giao tiếp rõ ràng tạo ra khác biệt lớn',
        paragraphs: [
          'Một lộ trình điều trị được giải thích đơn giản, theo từng bước nhỏ và có điểm liên lạc rõ ràng giúp gia đình bớt cảm giác bị “quá tải y khoa”. Đây là yếu tố thường bị đánh giá thấp nhưng lại quyết định mức độ đồng hành dài hạn.',
          'Khi cha mẹ hiểu điều gì đang diễn ra và biết mình có thể làm gì hôm nay, mức lo âu thường giảm đi rõ rệt.',
        ],
      },
      {
        heading: 'Chăm sóc cho người chăm sóc',
        paragraphs: [
          'Ở các ca điều trị dài ngày, hỗ trợ tâm lý cho phụ huynh không phải điều phụ. Nó giúp duy trì năng lượng chăm sóc, tránh kiệt sức và giữ sự ổn định cho cả gia đình.',
          'Một đội ngũ nhi khoa tốt thường không chỉ điều trị cho trẻ, mà còn biết cách chăm sóc trải nghiệm của cả nhà.',
        ],
      },
    ],
  },
  {
    slug: 'robot-phau-thuat-va-gioi-han-thuc-te',
    category: 'technology',
    tag: 'CÔNG NGHỆ',
    title: 'Robot phẫu thuật đang tiến xa đến đâu và giới hạn thực tế là gì',
    excerpt: 'Robot không tự thay bác sĩ mổ, nhưng đang làm tốt vai trò tăng độ chính xác, tầm nhìn và độ ổn định thao tác.',
    readTime: '8 phút đọc',
    publishedAt: '04/04/2026',
    author: 'BS. Đặng Hữu Thành',
    role: 'Ngoại khoa ít xâm lấn',
    image: 'https://images.unsplash.com/photo-1579684385127-1ef15d508118?auto=format&fit=crop&w=1200&q=80',
    sections: [
      {
        heading: 'Robot đang giúp ích ở điểm nào',
        paragraphs: [
          'Trong những ca cần thao tác tinh, góc tiếp cận hẹp hoặc thời gian mổ dài, hệ thống robot giúp phóng đại hình ảnh, ổn định dụng cụ và giảm rung tay tự nhiên của người thao tác.',
          'Với bệnh nhân, lợi ích kỳ vọng thường là đường mổ nhỏ hơn, giảm chảy máu và hỗ trợ hồi phục thuận lợi hơn ở một số nhóm thủ thuật phù hợp.',
        ],
      },
      {
        heading: 'Hiểu đúng về vai trò của robot',
        paragraphs: [
          'Robot không tự quyết định phẫu thuật. Bác sĩ vẫn là người chỉ huy toàn bộ cuộc mổ, từ lập kế hoạch đến xử trí tình huống phát sinh. Công nghệ chỉ phát huy khi đi cùng đội ngũ được đào tạo bài bản.',
          'Vì thế, một trung tâm có robot chưa chắc đã tốt hơn nếu không có hệ thống chỉ định đúng, ekip đồng bộ và quy trình an toàn chặt chẽ.',
        ],
      },
      {
        heading: 'Điều bệnh nhân cần hỏi',
        paragraphs: [
          'Thay vì chỉ hỏi “có robot không”, bệnh nhân nên hỏi liệu kỹ thuật đó có phù hợp với tình trạng của mình, đội ngũ đã có kinh nghiệm ra sao và kỳ vọng hồi phục thực tế là gì.',
          'Những câu hỏi đúng sẽ giúp công nghệ trở về đúng vai trò: một công cụ tạo giá trị thực sự trong tay đúng người.',
        ],
      },
    ],
  },
  {
    slug: 'giac-ngu-chat-luong-trong-phuc-hoi-chuc-nang',
    category: 'recovery',
    tag: 'PHỤC HỒI',
    title: 'Giấc ngủ chất lượng có thể thay đổi tiến độ phục hồi chức năng',
    excerpt: 'Giấc ngủ tốt không chỉ giúp dễ chịu hơn mà còn tác động trực tiếp đến năng lượng tập luyện và cảm nhận đau.',
    readTime: '6 phút đọc',
    publishedAt: '04/04/2026',
    author: 'BS. Phan Ngọc Duy',
    role: 'Đơn vị Phục hồi chức năng',
    image: 'https://images.unsplash.com/photo-1541781774459-bb2af2f05b55?auto=format&fit=crop&w=1200&q=80',
    sections: [
      {
        heading: 'Tại sao giấc ngủ quan trọng',
        paragraphs: [
          'Khi ngủ không sâu hoặc thức giấc nhiều lần, cơ thể khó tái lập năng lượng cho ngày hôm sau. Với người đang phục hồi chức năng, điều đó đồng nghĩa với giảm động lực vận động và tăng cảm giác mệt.',
          'Giấc ngủ còn liên quan đến khả năng điều hòa cảm xúc và cảm nhận đau. Vì vậy, tối ưu giấc ngủ là một phần của trị liệu chứ không chỉ là lời khuyên sống lành mạnh.',
        ],
      },
      {
        heading: 'Những điều chỉnh có tác dụng thật',
        paragraphs: [
          'Lịch ngủ đều, ánh sáng dịu vào buổi tối, hạn chế màn hình và bố trí vận động hợp lý trong ngày thường giúp cải thiện rõ rệt hơn so với việc chỉ cố “ngủ nhiều hơn”.',
          'Nếu đau hoặc khó thở về đêm là nguyên nhân chính, người bệnh cần được đánh giá nguyên nhân gốc thay vì chỉ dùng biện pháp hỗ trợ chung.',
        ],
      },
      {
        heading: 'Kết hợp giấc ngủ vào kế hoạch phục hồi',
        paragraphs: [
          'Một kế hoạch phục hồi tốt cần xem giấc ngủ như một chỉ số theo dõi. Khi ngủ tốt hơn, người bệnh thường tập đều hơn, giao tiếp tốt hơn và cảm thấy tiến bộ rõ hơn từng tuần.',
          'Đó là lý do ngày càng nhiều chương trình phục hồi đưa giấc ngủ vào nhóm mục tiêu chính ngay từ đầu.',
        ],
      },
    ],
  },
  {
    slug: 'dinh-duong-ca-nhan-hoa-cho-benh-nhan-tim-mach',
    category: 'nutrition',
    tag: 'DINH DƯỠNG',
    title: 'Dinh dưỡng cá nhân hóa cho bệnh nhân tim mạch không còn là khuyến nghị chung',
    excerpt: 'Ăn ít muối là chưa đủ. Chế độ ăn cho bệnh nhân tim mạch đang được cá nhân hóa dựa trên mục tiêu cụ thể hơn.',
    readTime: '7 phút đọc',
    publishedAt: '03/04/2026',
    author: 'BS. Võ Huyền Trang',
    role: 'Chuyên khoa Tim mạch',
    image: 'https://images.unsplash.com/photo-1471864190281-a93a3070b6de?auto=format&fit=crop&w=1200&q=80',
    sections: [
      {
        heading: 'Khác biệt giữa các bệnh nhân tim mạch',
        paragraphs: [
          'Một bệnh nhân tăng huyết áp mới phát hiện sẽ có nhu cầu dinh dưỡng khác với người suy tim, rối loạn lipid máu hay vừa trải qua can thiệp mạch vành. Vì thế, cùng là “tim mạch” nhưng hướng dẫn ăn uống không thể giống nhau hoàn toàn.',
          'Việc cá nhân hóa bắt đầu từ mục tiêu: kiểm soát huyết áp, giảm phù, duy trì khối cơ hay hỗ trợ cân nặng hợp lý.',
        ],
      },
      {
        heading: 'Nhìn bữa ăn theo cấu trúc',
        paragraphs: [
          'Thay vì chỉ đếm món “được ăn” và “không được ăn”, cách tiếp cận hiện đại là xây lại cấu trúc bữa ăn. Điều này giúp người bệnh có lựa chọn rõ ràng hơn mà vẫn duy trì được thói quen lâu dài.',
          'Việc theo dõi lượng natri, tỷ lệ rau, chất béo tốt và lượng đạm phù hợp thường đem lại hiệu quả bền hơn so với các đợt kiêng ngắn hạn.',
        ],
      },
      {
        heading: 'Một thay đổi nhỏ nhưng thực tế',
        paragraphs: [
          'Điều quan trọng là bữa ăn cần phù hợp với nhịp sống và khả năng duy trì của người bệnh. Thực đơn tốt là thực đơn được áp dụng đều mỗi tuần, không phải thực đơn hoàn hảo nhưng sớm bị bỏ dở.',
          'Khi dinh dưỡng trở thành một phần của lối sống thay vì “giai đoạn điều trị”, hiệu quả thường mới thực sự rõ ràng.',
        ],
      },
    ],
  },
  {
    slug: 'lo-au-truoc-ket-qua-xet-nghiem-va-cach-doi-pho',
    category: 'psychology',
    tag: 'TÂM LÝ',
    title: 'Lo âu trước kết quả xét nghiệm là phản ứng bình thường nhưng cần được xử lý đúng',
    excerpt: 'Khoảng chờ kết quả thường là lúc người bệnh cảm thấy mất kiểm soát nhất, và điều đó cần được hỗ trợ chứ không nên bỏ qua.',
    readTime: '5 phút đọc',
    publishedAt: '03/04/2026',
    author: 'ThS. Đỗ Minh Châu',
    role: 'Tư vấn tâm lý y khoa',
    image: 'https://images.unsplash.com/photo-1516302752625-fcc3c50ae61f?auto=format&fit=crop&w=1200&q=80',
    sections: [
      {
        heading: 'Vì sao giai đoạn chờ kết quả khó chịu',
        paragraphs: [
          'Trong giai đoạn này, người bệnh thường có rất ít điều có thể chủ động. Sự thiếu chắc chắn khiến não bộ dễ lấp đầy khoảng trống bằng các kịch bản xấu nhất.',
          'Không ít người nói rằng họ mệt hơn trong lúc chờ kết quả so với khi đã có kế hoạch điều trị rõ ràng. Đây là phản ứng tâm lý phổ biến và không nên xem nhẹ.',
        ],
      },
      {
        heading: 'Cách đối phó hữu ích',
        paragraphs: [
          'Việc giới hạn thời gian tìm kiếm thông tin, duy trì sinh hoạt tối thiểu ổn định và chọn một người đồng hành đáng tin có thể giúp cảm giác hỗn loạn giảm đi đáng kể.',
          'Quan trọng hơn, bệnh viện cần truyền đạt rõ mốc thời gian, cách nhận kết quả và người liên hệ nếu có thắc mắc. Sự rõ ràng giúp giảm lo âu rất nhiều.',
        ],
      },
      {
        heading: 'Khi nào nên tìm hỗ trợ',
        paragraphs: [
          'Nếu lo âu kéo dài làm mất ngủ nặng, không ăn uống được hoặc gây hoảng sợ lặp lại, người bệnh nên được hỗ trợ chuyên môn. Không phải chờ đến khi mọi thứ trở nên nghiêm trọng mới cần can thiệp.',
          'Hỗ trợ đúng lúc sẽ giúp người bệnh bước vào giai đoạn tiếp theo với tâm thế ổn định hơn.',
        ],
      },
    ],
  },
  {
    slug: 'ho-so-suc-khoe-so-va-tuong-tac-nguoi-benh',
    category: 'technology',
    tag: 'CÔNG NGHỆ',
    title: 'Hồ sơ sức khỏe số đang thay đổi cách bệnh nhân tương tác với bệnh viện',
    excerpt: 'Một cổng bệnh nhân được thiết kế tốt giúp người dùng bớt phụ thuộc vào gọi điện và giảm cảm giác lạc trong hành trình điều trị.',
    readTime: '6 phút đọc',
    publishedAt: '02/04/2026',
    author: 'Trần Anh Tú',
    role: 'Chiến lược sản phẩm số y tế',
    image: 'https://images.unsplash.com/photo-1576091160550-2173dba999ef?auto=format&fit=crop&w=1200&q=80',
    sections: [
      {
        heading: 'Vai trò của hồ sơ sức khỏe số',
        paragraphs: [
          'Khi lịch hẹn, kết quả xét nghiệm, đơn thuốc và hướng dẫn chăm sóc nằm rời rạc ở nhiều nơi, người bệnh rất dễ bỏ sót thông tin quan trọng. Hồ sơ sức khỏe số giúp gom những điểm chạm đó về một trải nghiệm thống nhất hơn.',
          'Điều này đặc biệt hữu ích với người bệnh điều trị dài ngày hoặc có nhiều chuyên khoa cùng tham gia chăm sóc.',
        ],
      },
      {
        heading: 'Thiết kế tốt mới tạo ra giá trị',
        paragraphs: [
          'Một ứng dụng y tế không nên chỉ “có nhiều tính năng”. Giá trị thực nằm ở việc người bệnh có thể nhìn thấy điều cần thiết nhất ngay lúc cần: kết quả nào mới, lịch nào sắp đến và cần làm gì tiếp theo.',
          'Nếu giao diện khó hiểu hoặc thông báo quá nhiều, hệ thống số sẽ trở thành một nguồn căng thẳng mới thay vì công cụ hỗ trợ.',
        ],
      },
      {
        heading: 'Từ công nghệ đến niềm tin',
        paragraphs: [
          'Khi bệnh nhân cảm thấy có quyền truy cập rõ ràng vào thông tin của mình, cảm giác chủ động tăng lên. Điều này giúp họ hợp tác với điều trị tốt hơn và giảm bớt lo lắng không cần thiết.',
          'Vì thế, hồ sơ sức khỏe số không chỉ là một bài toán phần mềm, mà là một phần của chất lượng trải nghiệm y tế hiện đại.',
        ],
      },
    ],
  },
  {
    slug: 'van-dong-nhe-sau-dieu-tri-va-loi-ich-that-su',
    category: 'recovery',
    tag: 'PHỤC HỒI',
    title: 'Vận động nhẹ sau điều trị: ít nhưng đều thường hiệu quả hơn nhiều',
    excerpt: 'Nhiều người bệnh chờ đến khi “khỏe hẳn” mới vận động, nhưng giai đoạn khởi động nhẹ đúng lúc lại rất quan trọng.',
    readTime: '5 phút đọc',
    publishedAt: '02/04/2026',
    author: 'BS. Phạm Quốc Thiện',
    role: 'Phục hồi chức năng nội khoa',
    image: 'https://images.unsplash.com/photo-1517836357463-d25dfeac3438?auto=format&fit=crop&w=1200&q=80',
    sections: [
      {
        heading: 'Tại sao nên bắt đầu sớm có kiểm soát',
        paragraphs: [
          'Nằm yên quá lâu thường làm giảm nhanh thể lực, cứng khớp và tăng cảm giác mệt kéo dài. Với nhiều bệnh nhân, bắt đầu bằng vận động nhẹ có kiểm soát giúp cơ thể lấy lại tín hiệu hoạt động sớm hơn.',
          'Mức “nhẹ” ở đây không được đo bằng cảm giác chủ quan đơn thuần, mà cần phù hợp với chẩn đoán, nhịp tim, huyết áp và mức chịu đựng thực tế.',
        ],
      },
      {
        heading: 'Điều quan trọng là tính đều đặn',
        paragraphs: [
          'Một buổi đi bộ ngắn, vài bài thở kết hợp giãn cơ hoặc các bài tập ngồi-đứng đúng kỹ thuật thường có giá trị hơn nhiều so với những nỗ lực gắng sức ngắt quãng.',
          'Khi người bệnh cảm thấy mình “làm được” mỗi ngày, động lực hồi phục thường tăng lên theo tiến bộ rất thực tế.',
        ],
      },
      {
        heading: 'Theo dõi phản hồi cơ thể',
        paragraphs: [
          'Vận động tốt là vận động không làm triệu chứng nặng hơn kéo dài sau buổi tập. Nếu đau tăng rõ, khó thở hoặc mệt kiệt sức kéo dài, chương trình cần được điều chỉnh sớm.',
          'Đó là lý do phục hồi chức năng nên dựa trên phản hồi từng ngày, không chỉ theo một giáo án cứng nhắc.',
        ],
      },
    ],
  },
  {
    slug: 'xu-huong-bua-sang-giau-protein-trong-cham-soc-benh-man',
    category: 'nutrition',
    tag: 'DINH DƯỠNG',
    title: 'Bữa sáng giàu protein vì sao đang được quan tâm trong chăm sóc bệnh mạn',
    excerpt: 'Một bữa sáng đủ đạm có thể giúp giữ năng lượng ổn định hơn và hỗ trợ kiểm soát cơn đói trong ngày.',
    readTime: '5 phút đọc',
    publishedAt: '01/04/2026',
    author: 'CN. Dương Mỹ Hạnh',
    role: 'Chuyên viên dinh dưỡng',
    image: 'https://images.unsplash.com/photo-1482049016688-2d3e1b311543?auto=format&fit=crop&w=1200&q=80',
    sections: [
      {
        heading: 'Vì sao bữa sáng dễ bị xem nhẹ',
        paragraphs: [
          'Khi người bệnh mệt hoặc bận đi khám sớm, bữa sáng thường bị bỏ qua hoặc chỉ ăn rất nhanh bằng thực phẩm giàu đường. Điều này khiến năng lượng dao động mạnh và dễ gây mệt giữa buổi.',
          'Một bữa sáng có protein phù hợp giúp giữ cảm giác no, hỗ trợ kiểm soát đường huyết và duy trì chất lượng năng lượng ổn định hơn.',
        ],
      },
      {
        heading: 'Không cần quá cầu kỳ',
        paragraphs: [
          'Trứng, sữa chua, đậu, phô mai tươi, yến mạch kết hợp hạt hoặc một phần thịt nạc có thể tạo nên bữa sáng đơn giản nhưng hiệu quả. Điều quan trọng là dễ chuẩn bị và lặp lại được.',
          'Bữa sáng tốt không cần “ăn nhiều”, mà cần đúng cấu trúc để tránh đuối năng lượng vào cuối buổi sáng.',
        ],
      },
      {
        heading: 'Phù hợp với từng bệnh lý',
        paragraphs: [
          'Ở người bệnh thận, tim mạch hay tiểu đường, lượng đạm và cấu trúc bữa sáng vẫn cần được điều chỉnh cẩn thận. Cá nhân hóa luôn quan trọng hơn việc chạy theo xu hướng.',
          'Một thay đổi nhỏ nhưng đều đặn vào bữa đầu ngày thường tạo hiệu quả tích lũy rõ rệt.',
        ],
      },
    ],
  },
  {
    slug: 'tam-ly-sau-phau-thuat-va-khoang-trong-giai-thich',
    category: 'psychology',
    tag: 'TÂM LÝ',
    title: 'Tâm lý sau phẫu thuật: khoảng trống giải thích thường lớn hơn người ta nghĩ',
    excerpt: 'Nhiều người bệnh ổn định về mặt y khoa nhưng vẫn rơi vào trạng thái trống rỗng, khó chịu hoặc lo âu sau mổ.',
    readTime: '6 phút đọc',
    publishedAt: '01/04/2026',
    author: 'ThS. Hà An Nhiên',
    role: 'Nhà tâm lý sức khỏe',
    image: 'https://images.unsplash.com/photo-1516549655169-df83a0774514?auto=format&fit=crop&w=1200&q=80',
    sections: [
      {
        heading: 'Vì sao sau mổ vẫn dễ bất an',
        paragraphs: [
          'Nhiều người nghĩ phẫu thuật xong là giai đoạn căng nhất đã qua. Nhưng thực tế, khoảng sau mổ thường mở ra nhiều câu hỏi mới về đau, tiến độ hồi phục và thay đổi sinh hoạt.',
          'Nếu những thay đổi này không được giải thích đủ kỹ, người bệnh rất dễ cảm thấy mình đang “không hồi phục đúng cách” dù các chỉ số y khoa vẫn ổn.',
        ],
      },
      {
        heading: 'Giao tiếp phục hồi là một phần điều trị',
        paragraphs: [
          'Các mốc hồi phục, những triệu chứng nào là bình thường và khi nào cần quay lại viện nên được nói rõ, bằng ngôn ngữ dễ hiểu. Đây là cách giảm lo âu hiệu quả nhất sau phẫu thuật.',
          'Khi người bệnh biết mình đang ở giai đoạn nào và cần chờ điều gì, họ thường bớt cảm giác bất định hơn rất nhiều.',
        ],
      },
      {
        heading: 'Quan sát sức khỏe tinh thần sau mổ',
        paragraphs: [
          'Nếu tâm trạng tụt kéo dài, mất ngủ nặng hoặc xuất hiện sợ hãi khiến người bệnh tránh vận động, cần nghĩ đến hỗ trợ tâm lý sớm thay vì chờ “rồi sẽ hết”.',
          'Chăm sóc sau mổ tốt là chăm sóc cả thể chất lẫn trải nghiệm tinh thần của người bệnh.',
        ],
      },
    ],
  },
  {
    slug: 'cam-bien-theo-doi-tu-xa-trong-phuc-hoi-tai-nha',
    category: 'technology',
    tag: 'CÔNG NGHỆ',
    title: 'Cảm biến theo dõi từ xa đang mở rộng chăm sóc phục hồi tại nhà',
    excerpt: 'Dữ liệu nhịp tim, giấc ngủ và vận động giúp đội ngũ y tế theo dõi tiến triển mà không cần bệnh nhân đến viện quá nhiều.',
    readTime: '7 phút đọc',
    publishedAt: '31/03/2026',
    author: 'Nguyễn Quang Vinh',
    role: 'Điều phối chuyển đổi số lâm sàng',
    image: 'https://images.unsplash.com/photo-1516321318423-f06f85e504b3?auto=format&fit=crop&w=1200&q=80',
    sections: [
      {
        heading: 'Theo dõi từ xa đang giải quyết vấn đề gì',
        paragraphs: [
          'Với người cần phục hồi dài ngày, việc đến bệnh viện quá thường xuyên có thể làm tăng mệt mỏi và chi phí đi lại. Cảm biến theo dõi từ xa giúp đội ngũ y tế có thêm tín hiệu về nhịp sống thực tế của bệnh nhân tại nhà.',
          'Các dữ liệu như mức hoạt động, chất lượng ngủ hoặc nhịp tim khi gắng sức nhẹ có thể cho thấy tiến triển tốt hay dấu hiệu cần điều chỉnh kế hoạch.',
        ],
      },
      {
        heading: 'Không phải càng nhiều dữ liệu càng tốt',
        paragraphs: [
          'Điều quan trọng là chọn đúng chỉ số và ngữ cảnh sử dụng. Một hệ thống tốt cần lọc ra những tín hiệu thật sự hữu ích, thay vì làm cả bệnh nhân lẫn bác sĩ bị quá tải thông tin.',
          'Dữ liệu từ xa chỉ có ý nghĩa khi được đặt cạnh triệu chứng, trao đổi trực tiếp và mục tiêu hồi phục cụ thể.',
        ],
      },
      {
        heading: 'Tương lai của chăm sóc lai',
        paragraphs: [
          'Mô hình kết hợp giữa theo dõi tại nhà và tái khám đúng thời điểm đang là hướng đi thực tế. Nó giữ được sự an toàn lâm sàng nhưng giảm cảm giác phụ thuộc hoàn toàn vào lịch đến viện.',
          'Đây có thể là bước quan trọng để chăm sóc phục hồi trở nên linh hoạt và bền hơn cho nhiều nhóm bệnh nhân.',
        ],
      },
    ],
  },
];

export function getArticleBySlug(slug) {
  return NEWS_ARTICLES.find((item) => item.slug === slug);
}
