import { Injectable } from '@nestjs/common';

import type { UpdateProfileDto } from './dto/update-profile.dto';
import { toPublicUser, type PublicUser } from '../common/mappers/public-user.mapper';
import { PrismaService } from '../prisma/prisma.service';
import { UploadsService } from '../uploads/uploads.service';

@Injectable()
export class UsersService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly uploadsService: UploadsService,
  ) {}

  async updateProfile(userId: string, dto: UpdateProfileDto): Promise<PublicUser> {
    const user = await this.prisma.user.update({
      where: { id: userId },
      data: { displayName: dto.displayName },
    });
    return toPublicUser(user);
  }

  /**
   * Remplace la photo de profil. Ordre volontaire (docs/PHASE_STATUS.md, Bloc 4) :
   * 1) upload du nouveau fichier, 2) écriture en base du nouvel avatar — c'est cette
   * étape qui doit réussir avant toute suppression, sinon le fichier fraîchement
   * téléversé est nettoyé en best-effort et l'ancien avatar n'est jamais touché —
   * 3) suppression de l'ancien fichier en best-effort strict (ne doit jamais faire
   * échouer une réponse déjà réussie pour l'utilisateur).
   */
  async updateAvatar(userId: string, file: { buffer: Buffer; size: number }): Promise<PublicUser> {
    const uploaded = await this.uploadsService.save(file);

    const existing = await this.prisma.user.findUniqueOrThrow({
      where: { id: userId },
      select: { avatarUploadId: true },
    });

    let user;
    try {
      user = await this.prisma.user.update({
        where: { id: userId },
        data: { avatarUrl: uploaded.url, avatarUploadId: uploaded.id },
      });
    } catch (error) {
      await this.uploadsService.remove(uploaded.id).catch(() => undefined);
      throw error;
    }

    if (existing.avatarUploadId) {
      await this.uploadsService.remove(existing.avatarUploadId).catch(() => undefined);
    }

    return toPublicUser(user);
  }

  async removeAvatar(userId: string): Promise<PublicUser> {
    const existing = await this.prisma.user.findUniqueOrThrow({
      where: { id: userId },
      select: { avatarUploadId: true },
    });

    const user = await this.prisma.user.update({
      where: { id: userId },
      data: { avatarUrl: null, avatarUploadId: null },
    });

    if (existing.avatarUploadId) {
      await this.uploadsService.remove(existing.avatarUploadId).catch(() => undefined);
    }

    return toPublicUser(user);
  }
}
