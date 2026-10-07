package com.smashflow.service;

import com.smashflow.model.User;
import com.smashflow.repository.UserRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import javax.imageio.IIOImage;
import javax.imageio.ImageIO;
import javax.imageio.ImageWriteParam;
import javax.imageio.ImageWriter;
import javax.imageio.stream.ImageOutputStream;
import java.awt.Color;
import java.awt.Graphics2D;
import java.awt.RenderingHints;
import java.awt.image.BufferedImage;
import java.io.ByteArrayInputStream;
import java.io.ByteArrayOutputStream;
import java.io.IOException;
import java.util.Base64;
import java.util.LinkedHashMap;
import java.util.Map;

/**
 * Thu nhỏ ảnh đại diện đã lưu (base64 trong DB) về 128x128, JPEG chất lượng 70%
 * để giảm băng thông khi các danh sách trả kèm ảnh. Chạy lại nhiều lần vẫn an toàn:
 * ảnh nào không nhỏ đi sẽ được bỏ qua.
 */
@Service
@RequiredArgsConstructor
@Slf4j
public class AvatarOptimizationService {

    static {
        System.setProperty("java.awt.headless", "true");
    }

    public static final int TARGET_SIZE = 128;
    public static final float JPEG_QUALITY = 0.7f;

    private final UserRepository userRepository;

    /**
     * @param apply false = chỉ tính thử (không ghi DB), true = ghi ảnh đã thu nhỏ vào DB
     */
    @Transactional
    public Map<String, Object> optimizeAvatars(boolean apply) {
        long beforeChars = 0;
        long afterChars = 0;
        int candidates = 0;
        int changed = 0;
        int skipped = 0;
        int failed = 0;

        for (User user : userRepository.findAll()) {
            String avatar = user.getAvatarUrl();
            if (avatar == null || !avatar.startsWith("data:image/")) {
                continue;
            }
            candidates++;
            try {
                String optimized = optimizeDataUrl(avatar);
                if (optimized == null) {
                    failed++;
                    continue;
                }
                if (optimized.length() >= avatar.length()) {
                    skipped++;
                    continue;
                }
                beforeChars += avatar.length();
                afterChars += optimized.length();
                changed++;
                if (apply) {
                    user.setAvatarUrl(optimized);
                    userRepository.save(user);
                }
            } catch (Exception e) {
                failed++;
                log.warn("Không thể tối ưu ảnh đại diện của user id={}: {}", user.getId(), e.getMessage());
            }
        }

        Map<String, Object> result = new LinkedHashMap<>();
        result.put("applied", apply);
        result.put("candidates", candidates);
        result.put("changed", changed);
        result.put("skipped", skipped);
        result.put("failed", failed);
        result.put("beforeKb", beforeChars / 1024);
        result.put("afterKb", afterChars / 1024);
        result.put("savedKb", (beforeChars - afterChars) / 1024);
        return result;
    }

    /** Trả về data URL JPEG mới, hoặc null nếu không đọc được định dạng ảnh. */
    String optimizeDataUrl(String dataUrl) throws IOException {
        int comma = dataUrl.indexOf(',');
        if (comma < 0) {
            return null;
        }
        byte[] original = Base64.getMimeDecoder().decode(dataUrl.substring(comma + 1));
        BufferedImage source = ImageIO.read(new ByteArrayInputStream(original));
        if (source == null) {
            return null; // định dạng không hỗ trợ (ví dụ webp)
        }
        if (source.getWidth() <= TARGET_SIZE && source.getHeight() <= TARGET_SIZE) {
            return dataUrl; // đã đủ nhỏ, không nén lại để tránh giảm chất lượng mỗi lần chạy
        }
        byte[] jpeg = resizeToJpeg(source);
        return "data:image/jpeg;base64," + Base64.getEncoder().encodeToString(jpeg);
    }

    byte[] resizeToJpeg(BufferedImage source) throws IOException {
        int minDim = Math.min(source.getWidth(), source.getHeight());
        int sx = (source.getWidth() - minDim) / 2;
        int sy = (source.getHeight() - minDim) / 2;

        BufferedImage target = new BufferedImage(TARGET_SIZE, TARGET_SIZE, BufferedImage.TYPE_INT_RGB);
        Graphics2D g = target.createGraphics();
        try {
            g.setColor(Color.WHITE);
            g.fillRect(0, 0, TARGET_SIZE, TARGET_SIZE);
            g.setRenderingHint(RenderingHints.KEY_INTERPOLATION, RenderingHints.VALUE_INTERPOLATION_BICUBIC);
            g.setRenderingHint(RenderingHints.KEY_RENDERING, RenderingHints.VALUE_RENDER_QUALITY);
            g.drawImage(source, 0, 0, TARGET_SIZE, TARGET_SIZE, sx, sy, sx + minDim, sy + minDim, null);
        } finally {
            g.dispose();
        }

        ImageWriter writer = ImageIO.getImageWritersByFormatName("jpeg").next();
        try {
            ImageWriteParam param = writer.getDefaultWriteParam();
            param.setCompressionMode(ImageWriteParam.MODE_EXPLICIT);
            param.setCompressionQuality(JPEG_QUALITY);

            ByteArrayOutputStream out = new ByteArrayOutputStream();
            try (ImageOutputStream ios = ImageIO.createImageOutputStream(out)) {
                writer.setOutput(ios);
                writer.write(null, new IIOImage(target, null, null), param);
            }
            return out.toByteArray();
        } finally {
            writer.dispose();
        }
    }
}
