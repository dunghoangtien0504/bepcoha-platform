import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/sequelize';
import { AppLoggerService } from '../../common/logger/app-logger.service';
import { hashPassword } from '../../common/utils/password.util';
import { RoleEntity, UserEntity } from '../../database/models';
import { CreateUserDto, UpdateUserDto } from './dto/user.dto';

export interface PublicUser {
  id: string;
  roleId: string;
  roleName: string | null;
  fullName: string;
  displayName: string;
  email: string;
  phone: string | null;
  gender: string | null;
  birthday: string | null;
  title: string | null;
  isAdmin: boolean;
  isActive: boolean;
  reportToId: string | null;
  reportToName: string | null;
}

@Injectable()
export class UsersService {
  constructor(
    private readonly logger: AppLoggerService,
    @InjectModel(UserEntity) private readonly userModel: typeof UserEntity,
    @InjectModel(RoleEntity) private readonly roleModel: typeof RoleEntity,
  ) {
    this.logger.setContext(UsersService.name);
  }

  async list(): Promise<PublicUser[]> {
    const users = await this.userModel.findAll({
      include: [
        RoleEntity,
        { model: UserEntity, as: 'reportTo', attributes: ['id', 'fullName', 'displayName'] },
      ],
      order: [['fullName', 'ASC']],
    });
    return users.map((user) => this.toPublic(user));
  }

  async create(dto: CreateUserDto): Promise<PublicUser> {
    await this.assertRoleExists(dto.roleId);
    const existing = await this.userModel.findOne({ where: { email: dto.email } });
    if (existing) throw new ConflictException(`Email '${dto.email}' đã tồn tại`);

    const created = await this.userModel.create({
      roleId: dto.roleId,
      fullName: dto.fullName,
      displayName: dto.displayName?.trim() || dto.fullName,
      email: dto.email,
      passwordHashed: hashPassword(dto.password),
      phone: dto.phone ?? null,
      gender: dto.gender ?? 'unknow',
      birthday: dto.birthday ?? null,
      title: dto.title ?? null,
      isAdmin: dto.isAdmin ?? false,
      isActive: dto.isActive ?? true,
      reportToId: dto.reportToId ?? null,
    } as UserEntity);
    this.logger.logBusiness(UsersService.name, 'Tạo người dùng', { email: dto.email });
    return this.findOne(created.id);
  }

  async findOne(id: string): Promise<PublicUser> {
    const user = await this.userModel.findByPk(id, {
      include: [
        RoleEntity,
        { model: UserEntity, as: 'reportTo', attributes: ['id', 'fullName', 'displayName'] },
      ],
    });
    if (!user) throw new NotFoundException('Không tìm thấy người dùng');
    return this.toPublic(user);
  }

  async update(id: string, dto: UpdateUserDto): Promise<PublicUser> {
    const user = await this.userModel.findByPk(id);
    if (!user) throw new NotFoundException('Không tìm thấy người dùng');
    if (dto.roleId) await this.assertRoleExists(dto.roleId);

    await user.update({
      roleId: dto.roleId ?? user.roleId,
      fullName: dto.fullName ?? user.fullName,
      displayName: dto.displayName?.trim() || dto.fullName || user.displayName,
      phone: dto.phone ?? user.phone,
      gender: dto.gender ?? user.gender,
      birthday: dto.birthday ?? user.birthday,
      title: dto.title ?? user.title,
      isAdmin: dto.isAdmin ?? user.isAdmin,
      isActive: dto.isActive ?? user.isActive,
      reportToId: dto.reportToId ?? user.reportToId,
      ...(dto.password ? { passwordHashed: hashPassword(dto.password) } : {}),
    });
    return this.findOne(id);
  }

  async remove(id: string): Promise<void> {
    const removed = await this.userModel.destroy({ where: { id } });
    if (!removed) throw new NotFoundException('Không tìm thấy người dùng');
  }

  private async assertRoleExists(roleId: string): Promise<void> {
    const role = await this.roleModel.findByPk(roleId);
    if (!role) throw new NotFoundException('Vai trò không tồn tại');
  }

  private toPublic(user: UserEntity): PublicUser {
    return {
      id: user.id,
      roleId: user.roleId,
      roleName: user.role?.name ?? null,
      fullName: user.fullName,
      displayName: user.displayName,
      email: user.email,
      phone: user.phone,
      gender: user.gender,
      birthday: user.birthday,
      title: user.title,
      isAdmin: user.isAdmin,
      isActive: user.isActive,
      reportToId: user.reportToId,
      reportToName: user.reportTo?.fullName ?? user.reportTo?.displayName ?? null,
    };
  }
}
